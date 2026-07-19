// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

import {MoonFactory} from "src/MoonFactory.sol";
import {BondingCurve} from "src/BondingCurve.sol";
import {MoonToken} from "src/MoonToken.sol";
import {FeeRouter} from "src/FeeRouter.sol";
import {MoonBurner} from "src/MoonBurner.sol";
import {CreatorFeeVault} from "src/CreatorFeeVault.sol";
import {ReferralRegistry} from "src/ReferralRegistry.sol";
import {MoonV3Concentrator} from "src/MoonV3Concentrator.sol";

/// @title DeployScript
/// @notice Base script that deploys the full Moon system on a single chain.
/// @dev Per-chain scripts (DeployBsc, DeployBase, ...) inherit this and set the RPC env.
abstract contract DeployScript is Script {
    using stdJson for string;

    struct Deployed {
        address moonTokenImpl;
        address bondingCurveImpl;
        address feeRouter;
        address moonBurner;
        address creatorFeeVault;
        address referralRegistry;
        address v3Concentrator;
        address factory;
        address moonToken; // $MOON governance token (optional, set later)
    }

    /// @dev Override in subclass to provide chain-specific addresses.
    function _env(string memory key) internal view virtual returns (string memory) {
        return vm.envString(key);
    }

    function _deploy() internal returns (Deployed memory d) {
        address deployer = vm.addr(vm.envUint("WALLET_PRIVATE_KEY"));
        address treasury = vm.envAddress("WALLET_TREASURY_ADDRESS");
        address devWallet = vm.envAddress("WALLET_DEV_ADDRESS");
        // MoonBurner requires a non-zero moonToken address. Use treasury as a
        // placeholder — it can be updated later via MoonBurner.setMoonToken (admin only).
        // In production, deploy the $MOON governance token first and pass its address.
        address moonTokenGov = vm.envOr("CHAIN_MOON_TOKEN_ETHEREUM_SEPOLIA", treasury);
        // AUDIT-FIX H1: optional Uniswap V2 router for graduation LP seeding (0 = disabled).
        address dexRouter = vm.envOr("DEX_ROUTER", address(0));
        // Optional graduation threshold as a fraction of total supply, in WAD (1e18 = 100%).
        // 0 = default curve threshold (mainnet). Testnet e.g. 1e13 = 0.001% for fast graduation.
        uint256 graduationFractionWad = vm.envOr("GRADUATION_FRACTION_WAD", uint256(0));

        vm.startBroadcast(deployer);

        // 1. Implementations.
        d.moonTokenImpl = address(new MoonToken());
        d.bondingCurveImpl = address(new BondingCurve());

        // 2. Shared infra.
        d.creatorFeeVault = address(new CreatorFeeVault());
        d.referralRegistry = address(new ReferralRegistry());
        d.moonBurner = address(new MoonBurner(moonTokenGov, address(0), treasury)); // router set later
        d.feeRouter = address(new FeeRouter(devWallet, d.moonBurner, treasury));
        d.v3Concentrator = address(new MoonV3Concentrator(moonTokenGov));

        // 3. Factory.
        d.factory = address(
            new MoonFactory(
                d.feeRouter,
                d.creatorFeeVault,
                d.referralRegistry,
                d.v3Concentrator,
                treasury,
                d.moonTokenImpl,
                d.bondingCurveImpl
            )
        );

        // AUDIT-FIX: Grant factory ADMIN_ROLE on all infra contracts so it can
        // grant CALLER_ROLE / ACCRUER_ROLE / REFERRER_ROLE to newly-created curves.
        // Cast to payable because these contracts have receive() functions.
        CreatorFeeVault(payable(d.creatorFeeVault)).grantRole(bytes32(0x00), d.factory);
        ReferralRegistry(payable(d.referralRegistry)).grantRole(bytes32(0x00), d.factory);
        FeeRouter(payable(d.feeRouter)).grantRole(bytes32(0x00), d.factory);

        // AUDIT-FIX C1: Grant the FeeRouter CALLER_ROLE on the MoonBurner so its
        // buybackAndBurn calls succeed. Without this, the 30% burn share is transferred
        // to the MoonBurner but buybackAndBurn always reverts (caught by try/catch),
        // permanently stranding those funds.
        MoonBurner(payable(d.moonBurner))
            .grantRole(MoonBurner(payable(d.moonBurner)).CALLER_ROLE(), d.feeRouter);

        // AUDIT-FIX H1: configure the DEX router (used by both graduation LP seeding and
        // MoonBurner buyback swaps) when provided via env.
        if (dexRouter != address(0)) {
            MoonFactory(d.factory).setDexRouter(dexRouter);
            MoonBurner(payable(d.moonBurner)).setDexRouter(dexRouter);
        }

        // Configure a testnet-style graduation threshold when provided (0 keeps the default).
        if (graduationFractionWad != 0) {
            MoonFactory(d.factory).setGraduationFraction(graduationFractionWad);
        }

        vm.stopBroadcast();

        console.log("moonTokenImpl:", d.moonTokenImpl);
        console.log("bondingCurveImpl:", d.bondingCurveImpl);
        console.log("feeRouter:", d.feeRouter);
        console.log("moonBurner:", d.moonBurner);
        console.log("creatorFeeVault:", d.creatorFeeVault);
        console.log("referralRegistry:", d.referralRegistry);
        console.log("v3Concentrator:", d.v3Concentrator);
        console.log("factory:", d.factory);
    }

    /// @dev Save deployed addresses to a per-chain broadcast file.
    function _save(Deployed memory d, string memory chainKey) internal {
        string memory json = "deployed";
        json.serialize("moonTokenImpl", d.moonTokenImpl);
        json.serialize("bondingCurveImpl", d.bondingCurveImpl);
        json.serialize("feeRouter", d.feeRouter);
        json.serialize("moonBurner", d.moonBurner);
        json.serialize("creatorFeeVault", d.creatorFeeVault);
        json.serialize("referralRegistry", d.referralRegistry);
        json.serialize("v3Concentrator", d.v3Concentrator);
        json.serialize("factory", d.factory);
        string memory path = string.concat("deployments/", chainKey, ".json");
        json.write(path);
    }
}

/* ─────────────────────────  Per-chain scripts  ──────────────────────────── */

contract DeployBsc is DeployScript {
    function run() external returns (Deployed memory d) {
        d = _deploy();
        _save(d, "bsc");
    }
}

contract DeployBase is DeployScript {
    function run() external returns (Deployed memory d) {
        d = _deploy();
        _save(d, "base");
    }
}

contract DeployArbitrum is DeployScript {
    function run() external returns (Deployed memory d) {
        d = _deploy();
        _save(d, "arbitrum");
    }
}

contract DeployBscTestnet is DeployScript {
    function run() external returns (Deployed memory d) {
        d = _deploy();
        _save(d, "bsc-testnet");
    }
}

contract DeployBaseSepolia is DeployScript {
    function run() external returns (Deployed memory d) {
        d = _deploy();
        _save(d, "base-sepolia");
    }
}

contract DeployArbitrumSepolia is DeployScript {
    function run() external returns (Deployed memory d) {
        d = _deploy();
        _save(d, "arbitrum-sepolia");
    }
}

contract DeployEthereumSepolia is DeployScript {
    function run() external returns (Deployed memory d) {
        d = _deploy();
        _save(d, "ethereum-sepolia");
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console} from "forge-std/Test.sol";

import {MoonFactory} from "src/MoonFactory.sol";
import {BondingCurve} from "src/BondingCurve.sol";
import {MoonToken} from "src/MoonToken.sol";
import {FeeRouter} from "src/FeeRouter.sol";
import {MoonBurner} from "src/MoonBurner.sol";
import {CreatorFeeVault} from "src/CreatorFeeVault.sol";
import {ReferralRegistry} from "src/ReferralRegistry.sol";
import {MoonV3Concentrator} from "src/MoonV3Concentrator.sol";
import {IMoonFactory} from "src/interfaces/IMoonFactory.sol";
import {IMoonToken} from "src/interfaces/IMoonToken.sol";

/// @title MoonFactory.t.sol
/// @notice Tests for MoonFactory.createToken — all supply tiers, curve shapes, revert paths, fuzz.
contract MoonFactoryTest is Test {
    MoonFactory internal factory;
    FeeRouter internal feeRouter;
    MoonBurner internal moonBurner;
    CreatorFeeVault internal creatorFeeVault;
    ReferralRegistry internal referralRegistry;
    MoonV3Concentrator internal concentrator;

    address internal deployer = makeAddr("deployer");
    address internal treasury = makeAddr("treasury");
    address internal devWallet = makeAddr("devWallet");
    address internal creator = makeAddr("creator");

    function setUp() public {
        vm.startPrank(deployer);

        address moonTokenImpl = address(new MoonToken());
        address bondingCurveImpl = address(new BondingCurve());
        creatorFeeVault = new CreatorFeeVault();
        referralRegistry = new ReferralRegistry();
        moonBurner = new MoonBurner(address(0), address(0), treasury);
        feeRouter = new FeeRouter(devWallet, address(moonBurner), treasury);
        concentrator = new MoonV3Concentrator(address(0));

        factory = new MoonFactory(
            address(feeRouter),
            address(creatorFeeVault),
            address(referralRegistry),
            address(concentrator),
            treasury,
            moonTokenImpl,
            bondingCurveImpl
        );

        // Grant factory admin on the infra contracts so createToken can grant roles.
        creatorFeeVault.grantRole(0x00, address(factory));
        referralRegistry.grantRole(0x00, address(factory));
        feeRouter.grantRole(0x00, address(factory));

        vm.stopPrank();
    }

    /* ─────────────────────  Supply tiers  ────────────────────── */

    function testCreateToken_Tier1B_Linear() public {
        _testCreate(0, 0); // 1B, LINEAR
    }

    function testCreateToken_Tier10B_Linear() public {
        _testCreate(1, 0); // 10B, LINEAR
    }

    function testCreateToken_Tier100B_Linear() public {
        _testCreate(2, 0); // 100B, LINEAR
    }

    function testCreateToken_Tier1B_Exponential() public {
        _testCreate(0, 1);
    }

    function testCreateToken_Tier1B_Logarithmic() public {
        _testCreate(0, 2);
    }

    function _testCreate(uint8 tier, uint8 curve) internal {
        IMoonFactory.CreateParams memory params = _params(tier, curve);
        vm.prank(creator);
        (address token, address curveAddr) = factory.createToken(params);

        // Token initialized correctly.
        IMoonToken t = IMoonToken(token);
        assertEq(t.supplyTier(), tier);
        assertEq(t.curveShape(), curve);
        assertEq(t.totalSupplyInit(), factory.totalSupplyForTier(tier));
        assertEq(t.factory(), address(factory));
        assertEq(t.totalSupply(), 0, "Option B: no pre-mint");

        // Curve initialized correctly.
        BondingCurve c = BondingCurve(payable(curveAddr));
        assertEq(c.token(), token);
        assertFalse(c.graduated());

        // Factory tracked the token.
        assertEq(factory.allTokensLength(), 1);
        assertEq(factory.allTokens(0), token);
    }

    /* ─────────────────────  Revert paths  ────────────────────── */

    function testRevert_EmptyName() public {
        IMoonFactory.CreateParams memory p = _params(0, 0);
        p.name = "";
        vm.expectRevert(IMoonFactory.EmptyName.selector);
        vm.prank(creator);
        factory.createToken(p);
    }

    function testRevert_EmptySymbol() public {
        IMoonFactory.CreateParams memory p = _params(0, 0);
        p.symbol = "";
        vm.expectRevert(IMoonFactory.EmptySymbol.selector);
        vm.prank(creator);
        factory.createToken(p);
    }

    function testRevert_InvalidSupplyTier() public {
        vm.expectRevert(IMoonFactory.InvalidSupplyTier.selector);
        vm.prank(creator);
        factory.createToken(_params(3, 0));
    }

    function testRevert_InvalidCurveShape() public {
        vm.expectRevert(IMoonFactory.InvalidCurveShape.selector);
        vm.prank(creator);
        factory.createToken(_params(0, 3));
    }

    function testRevert_MaxTxTooHigh() public {
        IMoonFactory.CreateParams memory p = _params(0, 0);
        p.maxTxBps = 501;
        vm.expectRevert(IMoonFactory.InvalidMaxTx.selector);
        vm.prank(creator);
        factory.createToken(p);
    }

    function testRevert_MaxHoldTooHigh() public {
        IMoonFactory.CreateParams memory p = _params(0, 0);
        p.maxHoldBps = 1001;
        vm.expectRevert(IMoonFactory.InvalidMaxHold.selector);
        vm.prank(creator);
        factory.createToken(p);
    }

    function testRevert_CooldownTooHigh() public {
        IMoonFactory.CreateParams memory p = _params(0, 0);
        p.cooldownSeconds = 3601;
        vm.expectRevert(IMoonFactory.InvalidCooldown.selector);
        vm.prank(creator);
        factory.createToken(p);
    }

    /* ─────────────────────  Tier math  ───────────────────────── */

    function testTotalSupplyForTier() public view {
        assertEq(factory.totalSupplyForTier(0), 1_000_000_000e18);
        assertEq(factory.totalSupplyForTier(1), 10_000_000_000e18);
        assertEq(factory.totalSupplyForTier(2), 100_000_000_000e18);
    }

    function testRealReservesForTier() public view {
        assertEq(factory.realReservesForTier(0), 793_100_000e18);
        assertEq(factory.realReservesForTier(1), 7_931_000_000e18);
        assertEq(factory.realReservesForTier(2), 79_310_000_000e18);
    }

    function testRevert_TotalSupplyForTier_Invalid() public {
        vm.expectRevert(IMoonFactory.InvalidSupplyTier.selector);
        factory.totalSupplyForTier(5);
    }

    /* ─────────────────────  Fuzz  ────────────────────────────── */

    function testFuzz_CreateToken_TierAndCurve(uint8 tier, uint8 curve) public {
        tier = uint8(bound(tier, 0, 2));
        curve = uint8(bound(curve, 0, 2));

        IMoonFactory.CreateParams memory p = _params(tier, curve);
        vm.prank(creator);
        (address token,) = factory.createToken(p);

        assertEq(IMoonToken(token).supplyTier(), tier);
        assertEq(IMoonToken(token).curveShape(), curve);
    }

    function testFuzz_CreateToken_MaxTxBps(uint16 maxTxBps) public {
        maxTxBps = uint16(bound(maxTxBps, 0, 500));
        IMoonFactory.CreateParams memory p = _params(0, 0);
        p.maxTxBps = maxTxBps;
        vm.prank(creator);
        (address token,) = factory.createToken(p);
        assertEq(IMoonToken(token).maxTxBps(), maxTxBps);
    }

    function testFuzz_CreateToken_RevertBadTier(uint8 tier) public {
        vm.assume(tier > 2);
        vm.expectRevert();
        vm.prank(creator);
        factory.createToken(_params(tier, 0));
    }

    /* ─────────────────────  Helpers  ─────────────────────────── */

    function _params(uint8 tier, uint8 curve)
        internal
        pure
        returns (IMoonFactory.CreateParams memory)
    {
        return IMoonFactory.CreateParams({
            name: "Test Moon",
            symbol: "TMOON",
            imageUrl: "ipfs://test",
            description: "test token",
            maxTxBps: 100, // 1%
            maxHoldBps: 500, // 5%
            cooldownSeconds: 60,
            supplyTier: tier,
            curveShape: curve
        });
    }
}

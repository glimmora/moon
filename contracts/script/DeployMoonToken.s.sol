// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title SimpleMoonToken
/// @notice Minimal ERC-20 used as the $MOON governance token for the buyback-and-burn
///         flywheel. 1B fixed supply minted to the deployer at construction.
/// @dev This is intentionally simple — it is NOT the launchpad MoonToken. It is the
///      platform governance token that MoonBurner buybacks and burns.
contract SimpleMoonToken is ERC20 {
    uint256 private constant ONE_B = 1_000_000_000e18;

    constructor() ERC20("Moon", "MOON") {
        _mint(msg.sender, ONE_B);
    }
}

/// @title DeployMoonToken
/// @notice Deploys the $MOON governance token on a chain.
contract DeployMoonToken is Script {
    function run() external returns (address moon) {
        address deployer = vm.addr(vm.envUint("WALLET_PRIVATE_KEY"));
        vm.startBroadcast(deployer);
        moon = address(new SimpleMoonToken());
        vm.stopBroadcast();
        console.log("MOON deployed at:", moon);
    }
}

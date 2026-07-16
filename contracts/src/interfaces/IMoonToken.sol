// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IMoonToken
/// @notice Interface for the moon.fun ERC-20 token (Option B: mint-on-buy / burn-on-sell).
/// @dev Inherits IERC20. The factory mints/burns via MINTER_ROLE. totalSupply starts at 0.
interface IMoonToken is IERC20 {
    /* ─────────────────────────  Errors  ───────────────────────── */

    error NotFactory();
    error AlreadyInitialized();
    error InvalidMaxTx();
    error InvalidMaxHold();
    error InvalidCooldown();
    error InvalidSupplyTier();
    error ExceedsMaxTx();
    error ExceedsMaxHold();
    error CooldownActive();
    error NotExempt();

    /* ─────────────────────────  Events  ───────────────────────── */

    event Initialized(address indexed factory, uint256 totalSupplyInit, uint8 supplyTier);
    event ExemptSet(address indexed account, bool exempt);
    event LimitsUpdated(uint256 maxTxBps, uint256 maxHoldBps, uint256 cooldownSeconds);

    /* ─────────────────────────  Roles  ────────────────────────── */

    function MINTER_ROLE() external view returns (bytes32);

    /* ─────────────────────────  Mint / Burn  ──────────────────── */

    /// @notice Mint tokens to `to`. Caller must have MINTER_ROLE.
    function mint(address to, uint256 amount) external;

    /// @notice Burn `amount` of the caller's own tokens.
    function burn(uint256 amount) external;

    /// @notice Burn `amount` from `from` (allowance / MINTER_ROLE). Used by the curve on sell.
    function burnFrom(address from, uint256 amount) external;

    /* ─────────────────────────  Init  ─────────────────────────── */

    struct InitParams {
        string name;
        string symbol;
        uint8 supplyTier; // 0 = 1B, 1 = 10B, 2 = 100B
        uint8 curveShape; // 0 = LINEAR, 1 = EXPONENTIAL, 2 = LOGARITHMIC
        uint256 maxTxBps; // 0..500 (5%)
        uint256 maxHoldBps; // 0..1000 (10%)
        uint256 cooldownSeconds; // 0..3600
    }

    /// @notice One-shot initializer called by the factory right after cloning.
    function initialize(InitParams calldata params, address factory) external;

    /* ─────────────────────────  Getters  ──────────────────────── */

    function factory() external view returns (address);
    function totalSupplyInit() external view returns (uint256);
    function supplyTier() external view returns (uint8);
    function curveShape() external view returns (uint8);
    function maxTxBps() external view returns (uint256);
    function maxHoldBps() external view returns (uint256);
    function cooldownSeconds() external view returns (uint256);
    function isExempt(address account) external view returns (bool);

    /* ─────────────────────────  Admin  ────────────────────────── */

    /// @notice Set exempt status for an account (factory/bonding curve / DEX pair / dead).
    function setExempt(address account, bool exempt) external;

    /// @notice Grant MINTER_ROLE to another address (e.g. the bonding curve clone).
    /// @dev AUDIT-FIX CRITICAL: Factory uses this to grant MINTER_ROLE to the curve.
    function grantMinterRole(address account) external;
}

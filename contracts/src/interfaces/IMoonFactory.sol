// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IMoonFactory
/// @notice Interface for the clone factory that deploys MoonToken + BondingCurve pairs.
interface IMoonFactory {
    /* ─────────────────────────  Enums  ────────────────────────── */

    enum CurveShape {
        LINEAR,
        EXPONENTIAL,
        LOGARITHMIC
    }

    /* ─────────────────────────  Errors  ───────────────────────── */

    error EmptyName();
    error EmptySymbol();
    error InvalidMaxTx();
    error InvalidMaxHold();
    error InvalidCooldown();
    error InvalidSupplyTier();
    error InvalidCurveShape();
    error NotAuthorized();

    /* ─────────────────────────  Structs  ──────────────────────── */

    struct CreateParams {
        string name;
        string symbol;
        string imageUrl;
        string description;
        uint256 maxTxBps; // 0..500
        uint256 maxHoldBps; // 0..1000
        uint256 cooldownSeconds; // 0..3600
        uint8 supplyTier; // 0=1B, 1=10B, 2=100B
        uint8 curveShape; // 0=LINEAR, 1=EXPONENTIAL, 2=LOGARITHMIC
    }

    /* ─────────────────────────  Events  ───────────────────────── */

    event TokenCreated(
        address indexed token,
        address indexed curve,
        address indexed creator,
        string name,
        string symbol,
        uint8 supplyTier,
        uint8 curveShape,
        uint256 totalSupply,
        string imageUrl,
        string description
    );
    event MoonTokenImplUpgraded(address indexed newImpl);
    event BondingCurveImplUpgraded(address indexed newImpl);

    /* ─────────────────────────  Create  ───────────────────────── */

    /// @notice Deploy a new token + bonding curve pair.
    /// @return token The deployed MoonToken clone address.
    /// @return curve The deployed BondingCurve clone address.
    function createToken(CreateParams calldata params)
        external
        returns (address token, address curve);

    /* ─────────────────────────  Getters  ──────────────────────── */

    function feeRouter() external view returns (address);
    function creatorFeeVault() external view returns (address);
    function referralRegistry() external view returns (address);
    function v3Concentrator() external view returns (address);
    function treasury() external view returns (address);
    function moonToken() external view returns (address);
    function moonTokenImpl() external view returns (address);
    function bondingCurveImpl() external view returns (address);
    function allTokens(uint256 index) external view returns (address);
    function allTokensLength() external view returns (uint256);

    /* ─────────────────────────  Tier math  ────────────────────── */

    /// @notice Total supply (1e18) for a given supply tier.
    function totalSupplyForTier(uint8 tier) external pure returns (uint256);

    /// @notice Real token reserves (1e18) for a given supply tier.
    function realReservesForTier(uint8 tier) external pure returns (uint256);

    /// @notice Virtual quote reserves (1e18) for a given supply tier.
    function virtualReservesForTier(uint8 tier) external pure returns (uint256);

    /* ─────────────────────────  Admin  ────────────────────────── */

    function upgradeMoonTokenImpl(address newImpl) external;
    function upgradeBondingCurveImpl(address newImpl) external;
}

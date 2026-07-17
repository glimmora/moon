// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IMoonBurner
/// @notice Buyback-and-burn engine for the $MOON governance token.
/// @dev Only the FeeRouter (CALLER_ROLE) may call buybackAndBurn.
interface IMoonBurner {
    /* ─────────────────────────  Errors  ───────────────────────── */

    error NotCaller();
    error NotAuthorized();
    error BurnerPaused();
    error ZeroAmount();
    error ZeroAddress(); // AUDIT-FIX L-1
    error RescueBlocked();

    /* ─────────────────────────  Events  ───────────────────────── */

    event BuybackAndBurn(uint256 quoteIn, uint256 moonBought, uint256 moonBurned);
    event BuybackSkipped(uint256 quoteAmount, string reason);
    // NOTE: Paused/Unpaused events are inherited from OpenZeppelin's Pausable — not redeclared here.
    event Rescued(address indexed token, address indexed to, uint256 amount);
    event MoonTokenSet(address indexed newMoonToken);
    event DexRouterUpdated(address indexed oldRouter, address indexed newRouter);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    /* ─────────────────────────  Core  ─────────────────────────── */

    /// @notice Buyback $MOON with `quoteAmount` of `quoteAsset` and burn the bought $MOON.
    /// @dev Wrapped in try/catch on the internal _executeSwap self-call. Emits BuybackSkipped on failure.
    /// @return moonBurned The amount of $MOON burned.
    function buybackAndBurn(address quoteAsset, uint256 quoteAmount) external returns (uint256 moonBurned);

    /* ─────────────────────────  Getters  ──────────────────────── */

    function moonToken() external view returns (address);
    function dexRouter() external view returns (address);
    function treasury() external view returns (address);
    function paused() external view returns (bool);
    function hasCallerRole(address account) external view returns (bool);

    /* ─────────────────────────  Admin  ────────────────────────── */

    function pause() external;
    function unpause() external;

    /// @notice Rescue non-MOON tokens / native sent by mistake.
    /// @dev Blocks the $MOON token (i_moonToken) from being rescued.
    function rescue(address token, address to, uint256 amount) external;
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IMoonV3Concentrator
/// @notice V2 → V3 LP migrator (stub). Burns V2 LP and returns underlying tokens.
/// @dev V3 mint is intentionally not implemented; concentrate() returns tokens to the user.
interface IMoonV3Concentrator {
    /* ─────────────────────────  Errors  ───────────────────────── */

    error ZeroAmount();
    error InvalidRange();
    error RescueBlocked();
    error NotAuthorized();

    /* ─────────────────────────  Events  ───────────────────────── */

    event Concentrated(
        address indexed user,
        address indexed pair,
        uint256 lpBurned,
        uint256 amount0,
        uint256 amount1
    );
    event DefaultRangeUpdated(uint256 rangeBps);
    event Rescued(address indexed token, address indexed to, uint256 amount);

    /* ─────────────────────────  Core  ─────────────────────────── */

    /// @notice Burn V2 LP tokens `lpAmount` and return the underlying tokens to `msg.sender`.
    /// @dev V3 mint is NOT implemented in this stub — tokens are returned directly.
    /// @param pair The Uniswap V2 pair address.
    /// @param lpAmount Amount of LP tokens to burn.
    /// @return amount0 Token0 returned.
    /// @return amount1 Token1 returned.
    function concentrate(address pair, uint256 lpAmount)
        external
        returns (uint256 amount0, uint256 amount1);

    /* ─────────────────────────  Getters  ──────────────────────── */

    function moonToken() external view returns (address);
    function getDefaultRangeBps() external view returns (uint256);

    /* ─────────────────────────  Admin  ────────────────────────── */

    function setDefaultRangeBps(uint256 rangeBps) external;

    /// @notice Rescue non-MOON tokens sent by mistake.
    /// @dev Blocks the $MOON token.
    function rescue(address token, address to, uint256 amount) external;
}

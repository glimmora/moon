// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ICreatorFeeVault
/// @notice Accumulates creator fee shares per token; pull-payment claims.
/// @dev ACCRUER_ROLE is granted to bonding curves. The creator is set on first accrue
///      and is immutable afterwards (anti-hijack).
interface ICreatorFeeVault {
    /* ─────────────────────────  Errors  ───────────────────────── */

    error NotAccruer();
    error NotAuthorized();
    error AlreadySet();
    error ZeroAmount();
    error NoClaimable();
    error InvalidToken();
    error ZeroAddress();

    /* ─────────────────────────  Events  ───────────────────────── */

    event FeesAccrued(
        address indexed token, address indexed creator, address quoteAsset, uint256 amount
    );
    event FeesClaimed(address indexed creator, address indexed quoteAsset, uint256 amount);
    event AccruerGranted(address indexed curve);
    event AccruerRevoked(address indexed curve);

    /* ─────────────────────────  Core  ─────────────────────────── */

    /// @notice Accrue `amount` of `quoteAsset` to the creator of `token`.
    /// @dev Only callable by an authorized bonding curve. Sets the creator on first call.
    /// @param token The MoonToken whose creator earns the fee.
    /// @param creator The creator address (immutable after first accrue).
    /// @param quoteAsset The quote asset address (address(0) for native).
    /// @param amount Amount of quote asset to accrue.
    function accrueFees(address token, address creator, address quoteAsset, uint256 amount) external;

    /// @notice Claim all fees owed to the caller for a single quote asset.
    function claimFees(address quoteAsset) external returns (uint256 amount);

    /// @notice Batch-claim fees across all quote assets owed to the caller.
    function claimAllFees() external returns (uint256 total);

    /* ─────────────────────────  Getters  ──────────────────────── */

    function creatorOf(address token) external view returns (address);
    function claimable(address creator, address quoteAsset) external view returns (uint256);
    function hasAccruerRole(address account) external view returns (bool);

    /* ─────────────────────────  Admin  ────────────────────────── */

    function grantAccruerRole(address curve) external;
    function revokeAccruerRole(address curve) external;
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IReferralRegistry
/// @notice On-chain referral tracking with permanent referrer links (anti-abuse).
/// @dev REFERRER_ROLE granted to bonding curves. recordReferral has exactly 6 params.
interface IReferralRegistry {
    /* ─────────────────────────  Errors  ───────────────────────── */

    error NotReferrer();
    error NotAuthorized();
    error CodeExists();
    error CodeNotFound();
    error AlreadyReferred();
    error CannotSelfRefer();
    error ZeroAddress();
    error NoClaimable();

    /* ─────────────────────────  Events  ───────────────────────── */

    event CodeRegistered(address indexed referrer, bytes32 code);
    event ReferrerSet(address indexed trader, address indexed referrer);
    event ReferralRecorded(
        address indexed trader,
        address indexed referrer,
        address indexed token,
        uint256 tradeVolume,
        uint256 rewardAmount,
        address quoteAsset
    );
    event RewardsClaimed(address indexed referrer, address indexed quoteAsset, uint256 amount);
    event ReferrerGranted(address indexed curve);
    event ReferrerRevoked(address indexed curve);

    /* ─────────────────────────  Referrer ops  ─────────────────── */

    /// @notice Register a unique referral code bound to the caller.
    function registerCode(bytes32 code) external;

    /// @notice Permanently link `trader` to `referrer`. One-shot per trader.
    /// @dev Reverts on self-referral or if already linked.
    function setReferrer(address referrer) external;

    /* ─────────────────────────  Curve-only  ───────────────────── */

    /// @notice Record a referral event. Exactly 6 params — no 5-param overload exists.
    /// @param trader The address that executed the trade.
    /// @param referrer The trader's referrer (address(0) if none).
    /// @param token The MoonToken traded.
    /// @param tradeVolume The trade volume in quote asset (1e18).
    /// @param rewardAmount The reward accrued to the referrer (1e18).
    /// @param quoteAsset The quote asset address (address(0) for native).
    function recordReferral(
        address trader,
        address referrer,
        address token,
        uint256 tradeVolume,
        uint256 rewardAmount,
        address quoteAsset
    ) external;

    /* ─────────────────────────  Claims  ───────────────────────── */

    /// @notice Pull-payment claim of referral rewards for one quote asset.
    function claimRewards(address quoteAsset) external returns (uint256 amount);

    /// @notice Batch-claim referral rewards across all quote assets for the caller.
    function claimAllRewards() external returns (uint256 total);

    /* ─────────────────────────  Getters  ──────────────────────── */

    function referrerOf(address trader) external view returns (address);
    function codeOwner(bytes32 code) external view returns (address);
    function claimableRewards(address referrer, address quoteAsset) external view returns (uint256);
    function totalReferralVolume(address referrer) external view returns (uint256);
    function referralCount(address referrer) external view returns (uint256);
    function hasReferrerRole(address account) external view returns (bool);

    /* ─────────────────────────  Admin  ────────────────────────── */

    function grantReferrerRole(address curve) external;
    function revokeReferrerRole(address curve) external;
}

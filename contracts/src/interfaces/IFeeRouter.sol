// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IFeeRouter
/// @notice Receives quote-asset fees from bonding curves and splits them.
/// @dev Split: 40% dev / 30% MoonBurner / 30% treasury.
interface IFeeRouter {
    /* ─────────────────────────  Errors  ───────────────────────── */

    error NotCaller();
    error ZeroAmount();
    error InvalidShares();
    error NotAuthorized();

    /* ─────────────────────────  Events  ───────────────────────── */

    event Distributed(
        address indexed curve,
        address indexed quoteAsset,
        uint256 amount,
        uint256 devShare,
        uint256 burnShare,
        uint256 treasuryShare
    );
    event SharesUpdated(uint256 devBps, uint256 burnBps, uint256 treasuryBps);
    event DevWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event MoonBurnerUpdated(address indexed oldBurner, address indexed newBurner);
    event CallerGranted(address indexed curve);
    event CallerRevoked(address indexed curve);
    /// @dev AUDIT-FIX L-2: emitted when a native push to the original recipient failed
    ///      and funds were routed to treasury instead.
    event PushFallback(address indexed originalRecipient, address indexed treasury, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event Rescued(address indexed token, address indexed to, uint256 amount);

    /* ─────────────────────────  Core  ─────────────────────────── */

    /// @notice Distribute `amount` of `quoteAsset` held by the caller.
    /// @dev Only callable by a bonding curve with CALLER_ROLE.
    function distribute(address quoteAsset, uint256 amount) external payable;

    /* ─────────────────────────  Getters  ──────────────────────── */

    function devWallet() external view returns (address);
    function moonBurner() external view returns (address);
    function treasury() external view returns (address);
    function devBps() external view returns (uint256);
    function burnBps() external view returns (uint256);
    function treasuryBps() external view returns (uint256);
    function hasCallerRole(address account) external view returns (bool);

    /* ─────────────────────────  Admin  ────────────────────────── */

    function setShares(uint256 devBps_, uint256 burnBps_, uint256 treasuryBps_) external;
    function setDevWallet(address devWallet_) external;
    function setMoonBurner(address moonBurner_) external;
    function grantCallerRole(address curve) external;
    function revokeCallerRole(address curve) external;
    function setTreasury(address treasury_) external;
    function rescue(address token, address to, uint256 amount) external;
}

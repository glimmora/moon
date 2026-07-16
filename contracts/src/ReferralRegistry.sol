// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IReferralRegistry} from "src/interfaces/IReferralRegistry.sol";

/// @title ReferralRegistry
/// @notice On-chain referral tracking with permanent referrer links (anti-abuse).
/// @dev
///   • REFERRER_ROLE granted to bonding curves.
///   • recordReferral has exactly 6 params — NO 5-param overload exists.
///   • setReferrer is one-shot per trader (permanent link).
///   • claimRewards is pull-payment + nonReentrant.
contract ReferralRegistry is AccessControl, ReentrancyGuard, IReferralRegistry {
    using SafeERC20 for IERC20;

    /* ───────────────────────  Roles  ──────────────────────────── */

    bytes32 public constant REFERRER_ROLE = keccak256("REFERRER_ROLE");
    bytes32 private constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;

    /* ───────────────────────  Storage  ────────────────────────── */

    /// @dev trader → referrer (permanent once set).
    mapping(address => address) public referrerOf;

    /// @dev referral code → owner.
    mapping(bytes32 => address) public codeOwner;

    /// @dev referrer → quoteAsset → claimable rewards.
    mapping(address => mapping(address => uint256)) public claimableRewards;

    /// @dev referrer → aggregate stats.
    mapping(address => uint256) public totalReferralVolume;
    mapping(address => uint256) public referralCount;

    /// @dev All quote assets a referrer has earned across (for batch claim).
    mapping(address => address[]) private s_quoteAssets;
    mapping(address => mapping(address => bool)) private s_quoteSeen;

    /* ───────────────────────  Constructor  ────────────────────── */

    constructor() {
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    /* ───────────────────────  Referrer ops  ───────────────────── */

    /// @inheritdoc IReferralRegistry
    function registerCode(bytes32 code) external override {
        if (code == bytes32(0)) revert CodeNotFound();
        if (codeOwner[code] != address(0)) revert CodeExists();
        codeOwner[code] = msg.sender;
        emit CodeRegistered(msg.sender, code);
    }

    /// @inheritdoc IReferralRegistry
    function setReferrer(address referrer) external override {
        if (referrer == address(0)) revert ZeroAddress();
        if (referrer == msg.sender) revert CannotSelfRefer();
        if (referrerOf[msg.sender] != address(0)) revert AlreadyReferred();

        // The referrer must have a registered code OR be a known address.
        // (We accept any non-zero address to keep the UX frictionless; codes are for sharing.)
        referrerOf[msg.sender] = referrer;
        referralCount[referrer] += 1;
        emit ReferrerSet(msg.sender, referrer);
    }

    /* ───────────────────────  Curve-only  ─────────────────────── */

    /// @inheritdoc IReferralRegistry
    /// @dev Exactly 6 params. There is intentionally NO 5-param overload.
    function recordReferral(
        address trader,
        address referrer,
        address token,
        uint256 tradeVolume,
        uint256 rewardAmount,
        address quoteAsset
    ) external override onlyRole(REFERRER_ROLE) {
        if (referrer == address(0)) {
            // No referrer — nothing to record.
            return;
        }

        claimableRewards[referrer][quoteAsset] += rewardAmount;
        totalReferralVolume[referrer] += tradeVolume;

        if (!s_quoteSeen[referrer][quoteAsset]) {
            s_quoteSeen[referrer][quoteAsset] = true;
            s_quoteAssets[referrer].push(quoteAsset);
        }

        emit ReferralRecorded(trader, referrer, token, tradeVolume, rewardAmount, quoteAsset);
    }

    /* ───────────────────────  Claims  ─────────────────────────── */

    /// @inheritdoc IReferralRegistry
    function claimRewards(address quoteAsset) external override nonReentrant returns (uint256 amount) {
        amount = claimableRewards[msg.sender][quoteAsset];
        if (amount == 0) revert NoClaimable();

        claimableRewards[msg.sender][quoteAsset] = 0;
        _send(quoteAsset, msg.sender, amount);
        emit RewardsClaimed(msg.sender, quoteAsset, amount);
    }

    /// @dev Batch-claim all quote assets owed to the caller.
    function claimAllRewards() external nonReentrant returns (uint256 total) {
        address[] memory assets = s_quoteAssets[msg.sender];
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 amt = claimableRewards[msg.sender][assets[i]];
            if (amt == 0) continue;
            claimableRewards[msg.sender][assets[i]] = 0;
            _send(assets[i], msg.sender, amt);
            emit RewardsClaimed(msg.sender, assets[i], amt);
            total += amt;
        }
    }

    /* ───────────────────────  Admin  ──────────────────────────── */

    /// @inheritdoc IReferralRegistry
    function grantReferrerRole(address curve) external override onlyRole(ADMIN_ROLE) {
        _grantRole(REFERRER_ROLE, curve);
        emit ReferrerGranted(curve);
    }

    /// @inheritdoc IReferralRegistry
    function revokeReferrerRole(address curve) external override onlyRole(ADMIN_ROLE) {
        _revokeRole(REFERRER_ROLE, curve);
        emit ReferrerRevoked(curve);
    }

    /* ───────────────────────  Getters  ────────────────────────── */

    function hasReferrerRole(address account) external view returns (bool) {
        return hasRole(REFERRER_ROLE, account);
    }

    /* ───────────────────────  Internal  ───────────────────────── */

    function _send(address quoteAsset, address to, uint256 amount) internal {
        if (quoteAsset == address(0)) {
            (bool ok,) = payable(to).call{value: amount}("");
            require(ok, "native transfer failed");
        } else {
            IERC20(quoteAsset).safeTransfer(to, amount);
        }
    }

    /// @dev Accept native ETH.
    receive() external payable {}
}

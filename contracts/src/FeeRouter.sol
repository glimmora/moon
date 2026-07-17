// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IFeeRouter} from "src/interfaces/IFeeRouter.sol";
import {IMoonBurner} from "src/interfaces/IMoonBurner.sol";

/// @title FeeRouter
/// @notice Splits quote-asset fees: 40% dev / 30% MoonBurner / 30% treasury.
/// @dev Only bonding curves (CALLER_ROLE) may call distribute(). The MoonBurner
///      buybackAndBurn call is wrapped in try/catch; if MoonBurner is address(0) the
///      burn share is routed to the treasury instead.
contract FeeRouter is AccessControl, ReentrancyGuard, IFeeRouter {
    using SafeERC20 for IERC20;

    /* ───────────────────────  Errors  ────────────────────────── */
    error ZeroAddress();
    error PushFailed(); // AUDIT-FIX L-2: surface native transfer failures

    /* ───────────────────────  Roles  ──────────────────────────── */

    bytes32 public constant CALLER_ROLE = keccak256("CALLER_ROLE");
    bytes32 private constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;

    /* ───────────────────────  Storage  ────────────────────────── */

    address public devWallet;
    address public moonBurner;
    address public treasury;

    uint256 public devBps; // 4000 (40%)
    uint256 public burnBps; // 3000 (30%)
    uint256 public treasuryBps; // 3000 (30%)

    /* ───────────────────────  Constructor  ────────────────────── */

    constructor(address devWallet_, address moonBurner_, address treasury_) {
        if (devWallet_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        devWallet = devWallet_;
        moonBurner = moonBurner_; // may be address(0)
        treasury = treasury_;
        devBps = 4000;
        burnBps = 3000;
        treasuryBps = 3000;
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    /* ───────────────────────  Core  ───────────────────────────── */

    /// @inheritdoc IFeeRouter
    function distribute(address quoteAsset, uint256 amount)
        external
        payable
        override
        onlyRole(CALLER_ROLE)
        nonReentrant
    {
        if (amount == 0) revert ZeroAmount();

        // Pull the quote asset from the caller (the bonding curve).
        if (quoteAsset == address(0)) {
            // Native — caller must have sent value.
            require(msg.value == amount, "value mismatch");
        } else {
            IERC20(quoteAsset).safeTransferFrom(msg.sender, address(this), amount);
        }

        uint256 devShare = (amount * devBps) / 10_000;
        uint256 burnShare = (amount * burnBps) / 10_000;
        uint256 treasuryShare = amount - devShare - burnShare;

        // Dev share — push.
        _send(quoteAsset, devWallet, devShare);

        // Burn share → MoonBurner (if set), else treasury.
        if (moonBurner != address(0) && burnShare > 0) {
            _send(quoteAsset, moonBurner, burnShare);
            // Non-blocking buyback+burn.
            try IMoonBurner(moonBurner).buybackAndBurn(quoteAsset, burnShare) returns (
                uint256
            ) {
            // success
            }
                catch {
                // Buyback failed — funds stay in MoonBurner for next attempt.
            }
        } else {
            treasuryShare += burnShare;
        }

        // Treasury share — push.
        _send(quoteAsset, treasury, treasuryShare);

        emit Distributed(msg.sender, quoteAsset, amount, devShare, burnShare, treasuryShare);
    }

    /* ───────────────────────  Admin  ──────────────────────────── */

    /// @inheritdoc IFeeRouter
    function setShares(uint256 devBps_, uint256 burnBps_, uint256 treasuryBps_)
        external
        override
        onlyRole(ADMIN_ROLE)
    {
        if (devBps_ + burnBps_ + treasuryBps_ != 10_000) revert InvalidShares();
        devBps = devBps_;
        burnBps = burnBps_;
        treasuryBps = treasuryBps_;
        emit SharesUpdated(devBps_, burnBps_, treasuryBps_);
    }

    /// @inheritdoc IFeeRouter
    function setDevWallet(address devWallet_) external override onlyRole(ADMIN_ROLE) {
        if (devWallet_ == address(0)) revert ZeroAddress();
        emit DevWalletUpdated(devWallet, devWallet_);
        devWallet = devWallet_;
    }

    /// @inheritdoc IFeeRouter
    function setMoonBurner(address moonBurner_) external override onlyRole(ADMIN_ROLE) {
        emit MoonBurnerUpdated(moonBurner, moonBurner_);
        moonBurner = moonBurner_;
    }

    /// @inheritdoc IFeeRouter
    function grantCallerRole(address curve) external override onlyRole(ADMIN_ROLE) {
        _grantRole(CALLER_ROLE, curve);
        emit CallerGranted(curve);
    }

    /// @inheritdoc IFeeRouter
    function revokeCallerRole(address curve) external override onlyRole(ADMIN_ROLE) {
        _revokeRole(CALLER_ROLE, curve);
        emit CallerRevoked(curve);
    }

    /// @inheritdoc IFeeRouter
    function setTreasury(address treasury_) external override onlyRole(ADMIN_ROLE) {
        if (treasury_ == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, treasury_);
        treasury = treasury_;
    }

    /// @inheritdoc IFeeRouter
    function rescue(address token, address to, uint256 amount)
        external
        override
        onlyRole(ADMIN_ROLE)
    {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (token == address(0)) {
            (bool ok,) = payable(to).call{value: amount}("");
            if (!ok) revert PushFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
        emit Rescued(token, to, amount);
    }

    /* ───────────────────────  Getters  ────────────────────────── */

    function hasCallerRole(address account) external view returns (bool) {
        return hasRole(CALLER_ROLE, account);
    }

    /* ───────────────────────  Internal  ───────────────────────── */

    function _send(address quoteAsset, address to, uint256 amount) internal {
        if (amount == 0 || to == address(0)) return;
        if (quoteAsset == address(0)) {
            // AUDIT-FIX L-2: Surface native transfer failures instead of silently dropping.
            // If the primary recipient is a contract that reverts, fall back to treasury
            // so funds are not stuck. If treasury also fails, revert the whole distribution
            // (the caller bonding curve will then keep the funds for retry).
            (bool ok,) = payable(to).call{value: amount}("");
            if (!ok) {
                if (to == treasury) revert PushFailed();
                (bool retryOk,) = payable(treasury).call{value: amount}("");
                if (!retryOk) revert PushFailed();
                emit PushFallback(to, treasury, amount);
            }
        } else {
            IERC20(quoteAsset).safeTransfer(to, amount);
        }
    }

    /// @dev Accept native ETH from bonding curves (native quote asset path).
    receive() external payable {}
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {ICreatorFeeVault} from "src/interfaces/ICreatorFeeVault.sol";

/// @title CreatorFeeVault
/// @notice Accumulates creator fee shares per token. Pull-payment claims.
/// @dev
///   • ACCRUER_ROLE granted to bonding curves.
///   • The creator is set on the FIRST accrue for a token and is IMMUTABLE afterwards
///     (anti-hijack: a malicious factory upgrade cannot redirect fees).
///   • claimFees / claimAllFees are pull-payment + nonReentrant.
contract CreatorFeeVault is AccessControl, ReentrancyGuard, ICreatorFeeVault {
    using SafeERC20 for IERC20;

    /* ───────────────────────  Roles  ──────────────────────────── */

    bytes32 public constant ACCRUER_ROLE = keccak256("ACCRUER_ROLE");
    bytes32 private constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;

    /* ───────────────────────  Storage  ────────────────────────── */

    /// @dev token → creator (immutable after first accrue).
    mapping(address => address) public creatorOf;

    /// @dev creator → quoteAsset → claimable balance.
    mapping(address => mapping(address => uint256)) public claimable;

    /// @dev All quote assets a creator has accrued across (for batch claim).
    mapping(address => address[]) private s_quoteAssets;
    mapping(address => mapping(address => bool)) private s_quoteSeen;

    /* ───────────────────────  Constructor  ────────────────────── */

    constructor() {
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    /* ───────────────────────  Accrue  ─────────────────────────── */

    /// @inheritdoc ICreatorFeeVault
    function accrueFees(address token, address creator, address quoteAsset, uint256 amount)
        external
        override
        onlyRole(ACCRUER_ROLE)
    {
        if (amount == 0) revert ZeroAmount();
        if (token == address(0)) revert InvalidToken();
        // AUDIT-FIX M4: reject zero creator so fees can never accrue to an unclaimable address.
        if (creator == address(0)) revert ZeroAddress();

        // Set the creator on first accrue — immutable afterwards.
        address existing = creatorOf[token];
        if (existing == address(0)) {
            creatorOf[token] = creator;
        } else if (existing != creator) {
            // A different creator was already set — accrue to the ORIGINAL creator.
            creator = existing;
        }

        claimable[creator][quoteAsset] += amount;

        // Track quote assets for batch claim.
        if (!s_quoteSeen[creator][quoteAsset]) {
            s_quoteSeen[creator][quoteAsset] = true;
            s_quoteAssets[creator].push(quoteAsset);
        }

        emit FeesAccrued(token, creator, quoteAsset, amount);
    }

    /* ───────────────────────  Claims  ─────────────────────────── */

    /// @inheritdoc ICreatorFeeVault
    function claimFees(address quoteAsset) external override nonReentrant returns (uint256 amount) {
        amount = claimable[msg.sender][quoteAsset];
        if (amount == 0) revert NoClaimable();

        claimable[msg.sender][quoteAsset] = 0;
        _send(quoteAsset, msg.sender, amount);
        emit FeesClaimed(msg.sender, quoteAsset, amount);
    }

    /// @inheritdoc ICreatorFeeVault
    function claimAllFees() external override nonReentrant returns (uint256 total) {
        address[] memory assets = s_quoteAssets[msg.sender];
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 amt = claimable[msg.sender][assets[i]];
            if (amt == 0) continue;
            claimable[msg.sender][assets[i]] = 0;
            _send(assets[i], msg.sender, amt);
            emit FeesClaimed(msg.sender, assets[i], amt);
            total += amt;
        }
    }

    /* ───────────────────────  Admin  ──────────────────────────── */

    /// @inheritdoc ICreatorFeeVault
    function grantAccruerRole(address curve) external override onlyRole(ADMIN_ROLE) {
        _grantRole(ACCRUER_ROLE, curve);
        emit AccruerGranted(curve);
    }

    /// @inheritdoc ICreatorFeeVault
    function revokeAccruerRole(address curve) external override onlyRole(ADMIN_ROLE) {
        _revokeRole(ACCRUER_ROLE, curve);
        emit AccruerRevoked(curve);
    }

    /* ───────────────────────  Getters  ────────────────────────── */

    function hasAccruerRole(address account) external view returns (bool) {
        return hasRole(ACCRUER_ROLE, account);
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

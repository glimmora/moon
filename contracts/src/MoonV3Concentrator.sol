// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IMoonV3Concentrator} from "src/interfaces/IMoonV3Concentrator.sol";

/// @title MoonV3Concentrator
/// @notice V2 → V3 LP migrator (stub). Burns V2 LP and returns underlying tokens to the user.
/// @dev V3 mint is intentionally NOT implemented in this stub. `concentrate()` burns the
///      caller's V2 LP tokens and returns token0/token1 to the caller. The default range
///      is ±10% (1000 bps). The $MOON token (i_moonToken) is blocked from rescue.
contract MoonV3Concentrator is AccessControl, ReentrancyGuard, IMoonV3Concentrator {
    using SafeERC20 for IERC20;

    /* ───────────────────────  Roles  ──────────────────────────── */

    bytes32 private constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;

    /* ───────────────────────  Storage  ────────────────────────── */

    address public moonToken; // i_moonToken — blocked from rescue
    uint256 private s_defaultRangeBps = 1000; // ±10%

    /* ───────────────────────  Constructor  ────────────────────── */

    constructor(address moonToken_) {
        moonToken = moonToken_;
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    /* ───────────────────────  Core  ───────────────────────────── */

    /// @inheritdoc IMoonV3Concentrator
    /// @dev V3 mint is NOT implemented. This burns V2 LP and returns the underlying tokens
    ///      to the caller. A future upgrade will mint a V3 position within ±defaultRangeBps.
    function concentrate(address pair, uint256 lpAmount)
        external
        override
        nonReentrant
        returns (uint256, uint256)
    {
        // AUDIT-FIX H3: The previous implementation pulled the caller's V2 LP into this
        // contract and called pair.burn(msg.sender), which returns the underlying tokens
        // directly to the caller — making this contract a pointless middleman that would
        // strand LP if burn() reverted, while never minting the promised V3 position.
        // Until real V3 minting is implemented, this function is disabled to prevent any
        // possibility of fund loss.
        pair; // silence unused-parameter warnings
        lpAmount;
        revert NotImplemented();
    }

    /* ───────────────────────  Admin  ──────────────────────────── */

    /// @inheritdoc IMoonV3Concentrator
    function setDefaultRangeBps(uint256 rangeBps) external override onlyRole(ADMIN_ROLE) {
        if (rangeBps == 0 || rangeBps > 10_000) revert InvalidRange();
        s_defaultRangeBps = rangeBps;
        emit DefaultRangeUpdated(rangeBps);
    }

    /// @inheritdoc IMoonV3Concentrator
    function rescue(address token, address to, uint256 amount)
        external
        override
        onlyRole(ADMIN_ROLE)
    {
        if (token == moonToken) revert RescueBlocked();
        if (to == address(0)) revert ZeroAddress();
        if (token == address(0)) {
            (bool ok,) = payable(to).call{value: amount}("");
            require(ok, "transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
        emit Rescued(token, to, amount);
    }

    /* ───────────────────────  Getters  ────────────────────────── */

    function getDefaultRangeBps() external view override returns (uint256) {
        return s_defaultRangeBps;
    }

    /// @dev Accept native ETH.
    receive() external payable {}
}

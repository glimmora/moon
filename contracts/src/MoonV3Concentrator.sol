// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IMoonV3Concentrator} from "src/interfaces/IMoonV3Concentrator.sol";
import {IUniswapV2Pair} from "src/interfaces/IUniswapV2Pair.sol";

/// @title MoonV3Concentrator
/// @notice V2 → V3 LP migrator (stub). Burns V2 LP and returns underlying tokens to the user.
/// @dev V3 mint is intentionally NOT implemented in this stub. `concentrate()` burns the
///      caller's V2 LP tokens and returns token0/token1 to the caller. The default range
///      is ±10% (1000 bps). The $MOON token (i_moonToken) is blocked from rescue.
contract MoonV3Concentrator is AccessControl, IMoonV3Concentrator {
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
        returns (uint256 amount0, uint256 amount1)
    {
        if (lpAmount == 0) revert ZeroAmount();
        if (pair == address(0)) revert ZeroAmount();

        // Transfer LP tokens from the user to this contract.
        IUniswapV2Pair(pair).transferFrom(msg.sender, address(this), lpAmount);

        // Burn the LP tokens — Uniswap V2 returns token0/token1 to `to`.
        (amount0, amount1) = IUniswapV2Pair(pair).burn(msg.sender);

        // NOTE: V3 position minting is intentionally omitted in this stub.

        emit Concentrated(msg.sender, pair, lpAmount, amount0, amount1);
    }

    /* ───────────────────────  Admin  ──────────────────────────── */

    /// @inheritdoc IMoonV3Concentrator
    function setDefaultRangeBps(uint256 rangeBps) external override onlyRole(ADMIN_ROLE) {
        if (rangeBps == 0 || rangeBps > 10_000) revert InvalidRange();
        s_defaultRangeBps = rangeBps;
        emit DefaultRangeUpdated(rangeBps);
    }

    /// @inheritdoc IMoonV3Concentrator
    function rescue(address token, address to, uint256 amount) external override onlyRole(ADMIN_ROLE) {
        if (token == moonToken) revert RescueBlocked();
        if (to == address(0)) revert ZeroAmount();
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

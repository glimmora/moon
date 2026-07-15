// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {MoonToken} from "src/MoonToken.sol";
import {BondingCurve} from "src/BondingCurve.sol";
import {IMoonToken} from "src/interfaces/IMoonToken.sol";
import {IMoonFactory} from "src/interfaces/IMoonFactory.sol";
import {IBondingCurve} from "src/interfaces/IBondingCurve.sol";
import {IFeeRouter} from "src/interfaces/IFeeRouter.sol";
import {ICreatorFeeVault} from "src/interfaces/ICreatorFeeVault.sol";
import {IReferralRegistry} from "src/interfaces/IReferralRegistry.sol";

/// @title MoonFactory
/// @notice Clone factory that deploys MoonToken + BondingCurve pairs.
/// @dev On every createToken():
///   • clones a MoonToken and a BondingCurve,
///   • initializes both,
///   • grants CALLER_ROLE / ACCRUER_ROLE / REFERRER_ROLE on the shared infra contracts
///     via non-blocking try/catch,
///   • emits TokenCreated.
contract MoonFactory is AccessControl, IMoonFactory {
    using Clones for address;

    /* ───────────────────────  Errors  ─────────────────────────── */

    error ZeroAddress();

    /* ───────────────────────  Roles  ──────────────────────────── */

    bytes32 private constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 private constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /* ───────────────────────  Constants  ──────────────────────── */

    uint256 public constant ONE_B = 1_000_000_000e18;
    uint256 public constant BASE_REAL_RESERVES_PER_1B = 793_100_000e18;
    uint256 public constant BASE_VIRTUAL_RESERVES_PER_1B = 30e18; // quote

    /// @dev Curve shapes.
    uint8 public constant LINEAR = 0;
    uint8 public constant EXPONENTIAL = 1;
    uint8 public constant LOGARITHMIC = 2;

    /* ───────────────────────  Storage  ────────────────────────── */

    address public feeRouter;
    address public creatorFeeVault;
    address public referralRegistry;
    address public v3Concentrator;
    address public treasury;
    address public moonToken; // $MOON governance token (optional, for buyback)

    address public moonTokenImpl;
    address public bondingCurveImpl;

    address[] public allTokens;

    /* ───────────────────────  Constructor  ────────────────────── */

    constructor(
        address feeRouter_,
        address creatorFeeVault_,
        address referralRegistry_,
        address v3Concentrator_,
        address treasury_,
        address moonTokenImpl_,
        address bondingCurveImpl_
    ) {
        if (
            feeRouter_ == address(0) || creatorFeeVault_ == address(0) || referralRegistry_ == address(0)
                || treasury_ == address(0) || moonTokenImpl_ == address(0) || bondingCurveImpl_ == address(0)
        ) revert ZeroAddress();

        feeRouter = feeRouter_;
        creatorFeeVault = creatorFeeVault_;
        referralRegistry = referralRegistry_;
        v3Concentrator = v3Concentrator_;
        treasury = treasury_;
        moonTokenImpl = moonTokenImpl_;
        bondingCurveImpl = bondingCurveImpl_;

        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
    }

    /* ───────────────────────  Create  ─────────────────────────── */

    /// @inheritdoc IMoonFactory
    function createToken(CreateParams calldata params)
        external
        override
        returns (address token, address curve)
    {
        // Validate params.
        if (bytes(params.name).length == 0) revert EmptyName();
        if (bytes(params.symbol).length == 0) revert EmptySymbol();
        if (params.supplyTier > 2) revert InvalidSupplyTier();
        if (params.curveShape > LOGARITHMIC) revert InvalidCurveShape();
        if (params.maxTxBps > 500) revert InvalidMaxTx();
        if (params.maxHoldBps > 1000) revert InvalidMaxHold();
        if (params.cooldownSeconds > 3600) revert InvalidCooldown();

        // Clone the token + curve.
        token = moonTokenImpl.clone();
        curve = bondingCurveImpl.clone();

        // AUDIT-FIX H-1: Bootstrap the factory pointer on the new clone BEFORE __init().
        // This removes the prior `s_factory == address(0)` auto-bootstrap path that
        // allowed anyone to become the factory on the first call to __init().
        BondingCurve(payable(curve)).setFactory();

        // Compute reserves for the tier + curve.
        uint256 totalSupplyInit = totalSupplyForTier(params.supplyTier);
        uint256 realTokenReservesInit = realReservesForTier(params.supplyTier);
        uint256 virtualTokenReservesInit = _virtualTokenReserves(params.curveShape, params.supplyTier);
        uint256 virtualQuoteReservesInit = _virtualQuoteReserves(params.curveShape, params.supplyTier);

        // Initialize the token (factory is the minter).
        IMoonToken.InitParams memory ip = IMoonToken.InitParams({
            name: params.name,
            symbol: params.symbol,
            supplyTier: params.supplyTier,
            curveShape: params.curveShape,
            maxTxBps: params.maxTxBps,
            maxHoldBps: params.maxHoldBps,
            cooldownSeconds: params.cooldownSeconds
        });
        IMoonToken(token).initialize(ip, address(this));

        // Initialize the bonding curve. quoteAsset = address(0) (native) by default; the
        // factory can be extended to support ERC20 quote assets per-chain.
        BondingCurve(payable(curve)).__init(
            token,
            address(0), // native quote
            msg.sender, // creator
            feeRouter,
            creatorFeeVault,
            referralRegistry,
            address(0), // dex router set later via graduate path / per-chain
            params.curveShape,
            totalSupplyInit,
            realTokenReservesInit,
            virtualTokenReservesInit,
            virtualQuoteReservesInit
        );

        // Grant the curve the roles it needs on the shared infra (non-blocking try/catch).
        try IFeeRouter(feeRouter).grantCallerRole(curve) {} catch {}
        try ICreatorFeeVault(creatorFeeVault).grantAccruerRole(curve) {} catch {}
        try IReferralRegistry(referralRegistry).grantReferrerRole(curve) {} catch {}

        allTokens.push(token);

        emit TokenCreated(
            token,
            curve,
            msg.sender,
            params.name,
            params.symbol,
            params.supplyTier,
            params.curveShape,
            totalSupplyInit,
            params.imageUrl,
            params.description
        );
    }

    /* ───────────────────────  Tier math  ──────────────────────── */

    /// @inheritdoc IMoonFactory
    function totalSupplyForTier(uint8 tier) public pure override returns (uint256) {
        if (tier == 0) return ONE_B;
        if (tier == 1) return ONE_B * 10;
        if (tier == 2) return ONE_B * 100;
        revert InvalidSupplyTier();
    }

    /// @inheritdoc IMoonFactory
    function realReservesForTier(uint8 tier) public pure override returns (uint256) {
        // Scales linearly with the tier (1B → 793.1M, 10B → 7.931B, 100B → 79.31B).
        return BASE_REAL_RESERVES_PER_1B * _tierMultiplier(tier);
    }

    /// @inheritdoc IMoonFactory
    function virtualReservesForTier(uint8 tier) public pure override returns (uint256) {
        // Virtual quote reserves scale with the tier.
        return BASE_VIRTUAL_RESERVES_PER_1B * _tierMultiplier(tier);
    }

    function _tierMultiplier(uint8 tier) internal pure returns (uint256) {
        if (tier == 0) return 1;
        if (tier == 1) return 10;
        if (tier == 2) return 100;
        revert InvalidSupplyTier();
    }

    /// @dev Virtual token reserves depend on the curve shape.
    function _virtualTokenReserves(uint8 curveShape, uint8 tier) internal pure returns (uint256) {
        uint256 mult = _tierMultiplier(tier);
        if (curveShape == EXPONENTIAL) {
            return 1_073_000_000e18 * mult; // VIRTUAL_TOKEN_EXP_BASE
        }
        // LINEAR + LOGARITHMIC use the real-token base.
        return BASE_REAL_RESERVES_PER_1B * mult;
    }

    /// @dev Virtual quote reserves depend on the curve shape.
    function _virtualQuoteReserves(uint8 curveShape, uint8 tier) internal pure returns (uint256) {
        uint256 mult = _tierMultiplier(tier);
        if (curveShape == EXPONENTIAL) {
            return 30e18 * mult; // VIRTUAL_QUOTE_EXP_BASE
        }
        // LINEAR + LOGARITHMIC use the base virtual quote.
        return BASE_VIRTUAL_RESERVES_PER_1B * mult;
    }

    /* ───────────────────────  Admin  ──────────────────────────── */

    /// @inheritdoc IMoonFactory
    function upgradeMoonTokenImpl(address newImpl) external override onlyRole(UPGRADER_ROLE) {
        if (newImpl == address(0)) revert ZeroAddress();
        moonTokenImpl = newImpl;
        emit MoonTokenImplUpgraded(newImpl);
    }

    /// @inheritdoc IMoonFactory
    function upgradeBondingCurveImpl(address newImpl) external override onlyRole(UPGRADER_ROLE) {
        if (newImpl == address(0)) revert ZeroAddress();
        bondingCurveImpl = newImpl;
        emit BondingCurveImplUpgraded(newImpl);
    }

    function setMoonToken(address moonToken_) external onlyRole(ADMIN_ROLE) {
        moonToken = moonToken_;
    }

    /* ───────────────────────  Getters  ────────────────────────── */

    function allTokensLength() external view returns (uint256) {
        return allTokens.length;
    }
}

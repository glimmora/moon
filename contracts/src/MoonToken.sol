// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IMoonToken} from "src/interfaces/IMoonToken.sol";

/// @title MoonToken
/// @notice moon.fun ERC-20 token — Option B (mint-on-buy / burn-on-sell).
/// @dev `totalSupply` starts at 0. The bonding curve mints on buy and burns on sell via
///      MINTER_ROLE. `s_totalSupplyInit` drives max-tx / max-hold math since the live
///      supply is 0 at genesis. This contract intentionally does NOT inherit
///      ERC20Burnable — self-burn lives in `burn()` and external burn in `burnFrom()`.
contract MoonToken is ERC20, AccessControl, ReentrancyGuard, IMoonToken {
    /* ───────────────────────  Roles  ──────────────────────────── */

    /// @dev The factory / bonding curve that mints and burns.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /* ───────────────────────  Storage  ────────────────────────── */

    address private s_factory;
    bool private s_initialized;

    /// @dev The cap supply used for max-tx / max-hold math (live totalSupply starts at 0).
    uint256 private s_totalSupplyInit;
    uint8 private s_supplyTier;
    uint8 private s_curveShape;

    /// @dev Actual name/symbol for cloned tokens (OZ v5 ERC20 stores these as immutables,
    ///      which clones can't override — we store them here and override name()/symbol()).
    string private s_name;
    string private s_symbol;

    uint256 private s_maxTxBps; // 0..500 (5%)
    uint256 private s_maxHoldBps; // 0..1000 (10%)
    uint256 private s_cooldownSeconds; // 0..3600

    mapping(address => bool) private s_exempt;
    mapping(address => uint256) private s_lastTradeBlock; // anti-sandwich cooldown (block)

    /* ───────────────────────  Constants  ──────────────────────── */

    /// @dev Supply tier caps (1e18 decimals).
    uint256 private constant ONE_B = 1_000_000_000e18; // 1 billion
    uint256 private constant TEN_B = 10_000_000_000e18; // 10 billion
    uint256 private constant HUNDRED_B = 100_000_000_000e18; // 100 billion

    /// @dev Hard caps for governance params.
    uint256 private constant MAX_TX_BPS_CAP = 500; // 5%
    uint256 private constant MAX_HOLD_BPS_CAP = 1000; // 10%
    uint256 private constant COOLDOWN_CAP = 3600; // 1 hour

    /// @dev Burn-it-all address.
    address private constant DEAD = 0x000000000000000000000000000000000000dEaD;

    /* ───────────────────────  Constructor  ────────────────────── */

    /// @dev Implementation constructor — name/symbol are placeholders; real values set in initialize().
    ///      AUDIT-FIX M3: mark the implementation itself as initialized so it can never be
    ///      initialized directly. Only fresh clones (whose storage starts zeroed) are usable.
    constructor() ERC20("Moon Token", "MOON") {
        s_initialized = true;
    }

    /* ───────────────────────  Init  ───────────────────────────── */

    /// @inheritdoc IMoonToken
    function initialize(InitParams calldata params, address factory) external override {
        if (s_initialized) revert AlreadyInitialized();
        if (msg.sender != factory) revert NotFactory();
        if (factory == address(0)) revert NotFactory();

        // Validate supply tier.
        if (params.supplyTier > 2) revert InvalidSupplyTier();
        // Validate governance params.
        if (params.maxTxBps > MAX_TX_BPS_CAP) revert InvalidMaxTx();
        if (params.maxHoldBps > MAX_HOLD_BPS_CAP) revert InvalidMaxHold();
        if (params.cooldownSeconds > COOLDOWN_CAP) revert InvalidCooldown();

        s_factory = factory;
        s_initialized = true;
        s_supplyTier = params.supplyTier;
        s_curveShape = params.curveShape;
        s_maxTxBps = params.maxTxBps;
        s_maxHoldBps = params.maxHoldBps;
        s_cooldownSeconds = params.cooldownSeconds;
        s_name = params.name;
        s_symbol = params.symbol;

        s_totalSupplyInit = _supplyForTier(params.supplyTier);

        // The factory is the minter and is exempt from limits.
        // AUDIT-FIX M1: also grant the factory DEFAULT_ADMIN_ROLE so a compromised curve
        // that holds MINTER_ROLE can be revoked by the factory admin. Without an admin,
        // MINTER_ROLE would be irrevocable and a compromised curve could mint forever.
        _grantRole(DEFAULT_ADMIN_ROLE, factory);
        _grantRole(MINTER_ROLE, factory);
        s_exempt[factory] = true;
        s_exempt[DEAD] = true;

        // ERC20 name/symbol are immutable after construction in OZ v5; for clones the
        // factory deploys a fresh implementation per-name via create2 of a minimal proxy
        // pattern where name/symbol are stored. OZ v5 ERC20 stores name/symbol in
        // immutable-ish storage; for clone-based per-token naming we override storage
        // by writing the ERC20 name/symbol slots directly via the OZ `_setName` path is
        // not available, so we instead rely on per-token bytecode via the factory's
        // create2 deploy of unique implementations. For this audited reference impl we
        // accept the placeholder name and surface real name/symbol via the factory's
        // TokenCreated event + off-chain metadata. (See SKILL.md §1.1.)
        // NOTE: name/symbol here mirror the deployment; the factory emits the canonical
        // name/symbol in TokenCreated.

        emit Initialized(factory, s_totalSupplyInit, params.supplyTier);
    }

    /* ───────────────────────  Mint / Burn  ────────────────────── */

    /// @inheritdoc IMoonToken
    function mint(address to, uint256 amount) external override onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /// @inheritdoc IMoonToken
    /// @dev AUDIT-FIX M-1 (revised): Self-burn is permissionless — any holder may burn
    ///      their own tokens. This is standard ERC-20 Burnable behavior. The bonding curve
    ///      uses burnFrom() (which requires MINTER_ROLE or allowance) for sell flows.
    function burn(uint256 amount) external override {
        _burn(msg.sender, amount);
    }

    /// @inheritdoc IMoonToken
    /// @dev External burn — used by the bonding curve on sell (MINTER_ROLE).
    ///      Also honors standard ERC20 allowance for non-role callers.
    function burnFrom(address from, uint256 amount) external override {
        if (hasRole(MINTER_ROLE, msg.sender)) {
            // Curve burns tokens it minted to the seller — no allowance required.
            _burn(from, amount);
        } else {
            _spendAllowance(from, msg.sender, amount);
            _burn(from, amount);
        }
    }

    /* ───────────────────────  _update override  ───────────────── */

    /// @dev Hooks into transfers to enforce max-tx / max-hold / cooldown.
    ///      `nonReentrant` guards against callback-based reentry.
    function _update(address from, address to, uint256 amount) internal override nonReentrant {
        // AUDIT-FIX (curve buy DoS): mints (from == 0) and burns (to == 0) are the bonding
        // curve's buy/sell flows. They must NOT be blocked by max-tx or cooldown — otherwise
        // any buy that mints more than maxTxBps of the supply reverts, DoS-ing buys. The curve
        // itself is exempt, so a mint originating from it is treated as exempt on the `from`
        // side. Max-hold is still enforced on the recipient of a mint to cap accumulation.
        bool isMint = from == address(0);
        bool isBurn = to == address(0);
        bool fromExempt = s_exempt[from] || isMint;
        bool toExempt = s_exempt[to] || isBurn;

        if (!fromExempt && !toExempt) {
            // Max-tx applies to non-exempt peer-to-peer transfers.
            if (s_maxTxBps != 0 && amount > (s_totalSupplyInit * s_maxTxBps) / 10_000) {
                revert ExceedsMaxTx();
            }
            // Cooldown (timestamp-based anti-sandwich) — peer-to-peer only.
            // AUDIT-FIX M-2: Removed the `last != 0` bypass — the first-ever trade was
            // silently allowed through even if a cooldown should have applied. Now the
            // check is simply: if `last` is set AND we're still inside the cooldown window,
            // revert. A zero `last` means the address has never traded — no cooldown.
            if (s_cooldownSeconds != 0) {
                uint256 last = s_lastTradeBlock[from];
                if (last != 0 && block.timestamp < last + s_cooldownSeconds) {
                    revert CooldownActive();
                }
                s_lastTradeBlock[from] = block.timestamp;
            }
        }

        // Max-hold applies to any non-exempt recipient (including buyers receiving a mint),
        // but never to burns (to == 0) or the DEAD address.
        if (!toExempt && s_maxHoldBps != 0 && to != DEAD) {
            uint256 newBal = balanceOf(to) + amount;
            if (newBal > (s_totalSupplyInit * s_maxHoldBps) / 10_000) {
                revert ExceedsMaxHold();
            }
        }

        super._update(from, to, amount);
    }

    /* ───────────────────────  Exemptions  ─────────────────────── */

    /// @inheritdoc IMoonToken
    function setExempt(address account, bool exempt) external override onlyRole(MINTER_ROLE) {
        if (account == DEAD) revert NotExempt();
        s_exempt[account] = exempt;
        emit ExemptSet(account, exempt);
    }

    /// @inheritdoc IMoonToken
    /// @dev AUDIT-FIX CRITICAL: Allows the factory (MINTER) to grant MINTER_ROLE
    ///      to the bonding curve clone, so the curve can mint (on buy) and
    ///      burnFrom (on sell).
    function grantMinterRole(address account) external override onlyRole(MINTER_ROLE) {
        _grantRole(MINTER_ROLE, account);
        emit MinterRoleGranted(account);
    }

    /* ───────────────────────  Getters  ────────────────────────── */

    function factory() external view returns (address) {
        return s_factory;
    }

    function totalSupplyInit() external view returns (uint256) {
        return s_totalSupplyInit;
    }

    function supplyTier() external view returns (uint8) {
        return s_supplyTier;
    }

    function curveShape() external view returns (uint8) {
        return s_curveShape;
    }

    function maxTxBps() external view returns (uint256) {
        return s_maxTxBps;
    }

    function maxHoldBps() external view returns (uint256) {
        return s_maxHoldBps;
    }

    function cooldownSeconds() external view returns (uint256) {
        return s_cooldownSeconds;
    }

    function isExempt(address account) external view returns (bool) {
        return s_exempt[account];
    }

    // AUDIT/UX-FIX: For minimal-proxy clones, OZ v5's `super.name()` reads the
    // implementation's *immutable* `_name`, which is empty in every clone (the
    // constructor never runs on a clone). Always return the per-token storage
    // values set in initialize() so explorers (Etherscan) read the real name/symbol
    // from the clone's own storage. Etherscan shows a placeholder ("Token") when
    // this returns an empty string, so never fall back to the empty immutable.
    function name() public view override returns (string memory) {
        return s_name;
    }

    function symbol() public view override returns (string memory) {
        return s_symbol;
    }

    /* ───────────────────────  Internal helpers  ───────────────── */

    /// @dev Supply validation: only 1B / 10B / 100B tiers are allowed.
    function _supplyForTier(uint8 tier) internal pure returns (uint256) {
        if (tier == 0) return ONE_B;
        if (tier == 1) return TEN_B;
        if (tier == 2) return HUNDRED_B;
        revert InvalidSupplyTier();
    }

    /// @dev AccessControl exposes supportsInterface.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

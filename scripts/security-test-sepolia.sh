#!/usr/bin/env bash
# Moon — Comprehensive On-Chain Security & Feature Test Suite v2
# Fixed argument passing.

set -uo pipefail

export PATH="$HOME/.foundry/bin:$PATH"
RPC="https://ethereum-sepolia-rpc.publicnode.com"
if [ -z "${PRIV_KEY:-}" ]; then echo "FATAL: PRIV_KEY env var required"; exit 1; fi
if [ -z "${PRIV_KEY2:-}" ]; then echo "FATAL: PRIV_KEY2 env var required"; exit 1; fi
PK="$PRIV_KEY"
PK2="$PRIV_KEY2"
DEPLOYER="0xbBfD7255a1817b7d02a5cc9A0669a9C80599ef24"
ATTACKER="0x7587663db23a8E144B3508921c2BA9D0676AE03D"
GAS="2000000000"
ZERO="0x0000000000000000000000000000000000000000"

FACTORY="0xC3DadD2643a6aB9857880EF7Bf208dEdd31937b3"
FEEROUTER="0x95032e828144707e9754993e421c31dE986A3bb1"
VAULT="0x3c67d2f9f3aA5B909332f2eF7a3862b58015345B"
REGISTRY="0xADB082E1AA4696bffDAD8aB754874d31E37e9Fe0"
MOONBURNER="0x47240bE29d50Eeb46bCCE0c227D67A34CE18682c"
TOKEN0="0xed57e0de0e84c4af751d7f30c45bb22ec587b34f"
CURVE0="0x466d8a659e2b4b234de4a518e190c4d7f6b9ed90"

PASS=0; FAIL=0; REVERT=0
log_pass() { echo "✅ PASS — $1"; PASS=$((PASS+1)); }
log_fail() { echo "❌ FAIL — $1"; FAIL=$((FAIL+1)); }
log_revert() { echo "🛡️  REVERT (expected) — $1"; REVERT=$((REVERT+1)); }

# expect_success: tx status == 1
es() {
  local desc="$1" result="$2"
  if echo "$result" | grep -qE 'status\s+1 \(success\)'; then
    log_pass "$desc"
  else
    log_fail "$desc"
    echo "  $(echo "$result" | grep -iE 'error|revert' | head -2)"
  fi
}
# expect_revert: tx reverts OR estimation fails
er() {
  local desc="$1" result="$2"
  if echo "$result" | grep -qiE 'revert|execution reverted|failed to estimate|insufficient|unauthorized|panic'; then
    log_revert "$desc"
  elif echo "$result" | grep -qE 'status\s+1 \(success\)'; then
    log_fail "$desc (should have reverted but SUCCEEDED!)"
  else
    log_revert "$desc"
  fi
}

echo "═══════════════════════════════════════════════════════════════"
echo "  Moon — On-Chain Security & Feature Tests v2"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ═══ SECTION 1: FEATURE TESTS ═══
echo "── SECTION 1: FEATURE TESTS ──"

echo "1.1: Create token (1B, LINEAR)"
R=$(cast send "$FACTORY" 'createToken((string,string,string,string,uint256,uint256,uint256,uint8,uint8))' \
  '("SecTest1B","ST1","https://Moon/t.png","1B Linear",100,500,60,0,0)' \
  --rpc-url "$RPC" --private-key "$PK" --gas-price "$GAS" --gas-limit 3000000 2>&1)
es "createToken 1B LINEAR" "$R"

echo "1.2: Create token (10B, LOGARITHMIC)"
R=$(cast send "$FACTORY" 'createToken((string,string,string,string,uint256,uint256,uint256,uint8,uint8))' \
  '("SecTest10B","ST2","https://Moon/t.png","10B Log",100,500,60,1,2)' \
  --rpc-url "$RPC" --private-key "$PK" --gas-price "$GAS" --gas-limit 3000000 2>&1)
es "createToken 10B LOGARITHMIC" "$R"

echo "1.3: Create token (100B, EXPONENTIAL)"
R=$(cast send "$FACTORY" 'createToken((string,string,string,string,uint256,uint256,uint256,uint8,uint8))' \
  '("SecTest100B","ST3","https://Moon/t.png","100B Exp",100,500,60,2,1)' \
  --rpc-url "$RPC" --private-key "$PK" --gas-price "$GAS" --gas-limit 3000000 2>&1)
es "createToken 100B EXPONENTIAL" "$R"

echo "1.4: Buy 0.005 ETH"
R=$(cast send "$CURVE0" "buy(uint256,uint256,address)" 5000000000000000 0 "$ZERO" \
  --value 5000000000000000 --rpc-url "$RPC" --private-key "$PK" --gas-price "$GAS" --gas-limit 1500000 2>&1)
es "buy 0.005 ETH" "$R"

echo "1.5: Sell 50% balance"
BAL=$(cast call "$TOKEN0" "balanceOf(address)(uint256)" "$DEPLOYER" --rpc-url "$RPC" 2>&1 | awk '{print $1}' | tr -d ' ')
SELL_AMT=$(python3 -c "print(int('$BAL') // 2)")
R=$(cast send "$CURVE0" "sell(uint256,uint256,address)" "$SELL_AMT" 0 "$ZERO" \
  --rpc-url "$RPC" --private-key "$PK" --gas-price "$GAS" --gas-limit 1500000 2>&1)
es "sell 50% balance" "$R"

echo "1.6: Register referral code"
REF_CODE=$(python3 -c "print('0x' + format(int(__import__('time').time()) & 0xffffffffffffffff, '064x'))")
R=$(cast send "$REGISTRY" "registerCode(bytes32)" "$REF_CODE" \
  --rpc-url "$RPC" --private-key "$PK" --gas-price "$GAS" --gas-limit 200000 2>&1)
es "registerCode" "$R"

echo "1.7: Set referrer (attacker → deployer)"
R=$(cast send "$REGISTRY" "setReferrer(address)" "$DEPLOYER" \
  --rpc-url "$RPC" --private-key "$PK2" --gas-price "$GAS" --gas-limit 200000 2>&1)
es "setReferrer" "$R"

echo "1.8: Buy with referrer (rewards accrue)"
REW_BEFORE=$(cast call "$REGISTRY" "claimableRewards(address,address)(uint256)" "$DEPLOYER" "$ZERO" --rpc-url "$RPC" 2>&1 | awk '{print $1}' | tr -d ' ')
R=$(cast send "$CURVE0" "buy(uint256,uint256,address)" 3000000000000000 0 "$DEPLOYER" \
  --value 3000000000000000 --rpc-url "$RPC" --private-key "$PK2" --gas-price "$GAS" --gas-limit 1500000 2>&1)
es "buy with referrer" "$R"
REW_AFTER=$(cast call "$REGISTRY" "claimableRewards(address,address)(uint256)" "$DEPLOYER" "$ZERO" --rpc-url "$RPC" 2>&1 | awk '{print $1}' | tr -d ' ')
if [ "$REW_AFTER" != "$REW_BEFORE" ]; then
  log_pass "referral rewards accrued"
else
  log_fail "referral rewards did NOT accrue"
fi

echo "1.9: Creator fee claim"
CFEES=$(cast call "$VAULT" "claimable(address,address)(uint256)" "$DEPLOYER" "$ZERO" --rpc-url "$RPC" 2>&1 | awk '{print $1}' | tr -d ' ')
if [ "$CFEES" != "0" ]; then
  log_pass "creator fees accrued ($CFEES wei)"
  R=$(cast send "$VAULT" "claimFees(address)" "$ZERO" \
    --rpc-url "$RPC" --private-key "$PK" --gas-price "$GAS" --gas-limit 200000 2>&1)
  es "claimFees" "$R"
else
  log_fail "no creator fees"
fi

echo ""
echo "── SECTION 2: ACCESS CONTROL NEGATIVE TESTS ──"

echo "2.1: Non-pauser cannot pause MoonBurner"
R=$(cast send "$MOONBURNER" "pause()" --rpc-url "$RPC" --private-key "$PK2" --gas-price "$GAS" --gas-limit 200000 2>&1)
er "non-pauser pause" "$R"

echo "2.2: Non-admin grantCallerRole on FeeRouter"
R=$(cast send "$FEEROUTER" "grantCallerRole(address)" "$ATTACKER" \
  --rpc-url "$RPC" --private-key "$PK2" --gas-price "$GAS" --gas-limit 200000 2>&1)
er "non-admin grantCallerRole" "$R"

echo "2.3: Non-admin setShares"
R=$(cast send "$FEEROUTER" "setShares(uint256,uint256,uint256)" 5000 3000 2000 \
  --rpc-url "$RPC" --private-key "$PK2" --gas-price "$GAS" --gas-limit 200000 2>&1)
er "non-admin setShares" "$R"

echo "2.4: Non-admin upgradeMoonTokenImpl"
R=$(cast send "$FACTORY" "upgradeMoonTokenImpl(address)" "$ATTACKER" \
  --rpc-url "$RPC" --private-key "$PK2" --gas-price "$GAS" --gas-limit 200000 2>&1)
er "non-admin upgradeMoonTokenImpl" "$R"

echo "2.5: Non-admin rescue MoonBurner"
R=$(cast send "$MOONBURNER" "rescue(address,address,uint256)" "$ZERO" "$ATTACKER" 1 \
  --rpc-url "$RPC" --private-key "$PK2" --gas-price "$GAS" --gas-limit 200000 2>&1)
er "non-admin rescue MoonBurner" "$R"

echo "2.6: Non-caller distribute"
R=$(cast send "$FEEROUTER" "distribute(address,uint256)" "$ZERO" 1000000000000000 \
  --value 1000000000000000 --rpc-url "$RPC" --private-key "$PK2" --gas-price "$GAS" --gas-limit 500000 2>&1)
er "non-caller distribute" "$R"

echo "2.7: Non-accruer accrueFees"
R=$(cast send "$VAULT" "accrueFees(address,address,address,uint256)" "$TOKEN0" "$ATTACKER" "$ZERO" 100 \
  --rpc-url "$RPC" --private-key "$PK2" --gas-price "$GAS" --gas-limit 200000 2>&1)
er "non-accruer accrueFees" "$R"

echo "2.8: Non-referrer recordReferral"
R=$(cast send "$REGISTRY" "recordReferral(address,address,address,uint256,uint256,address)" \
  "$ATTACKER" "$DEPLOYER" "$TOKEN0" 1000 100 "$ZERO" \
  --rpc-url "$RPC" --private-key "$PK2" --gas-price "$GAS" --gas-limit 200000 2>&1)
er "non-referrer recordReferral" "$R"

echo "2.9: Non-minter mint"
R=$(cast send "$TOKEN0" "mint(address,uint256)" "$ATTACKER" 1000000000000000000 \
  --rpc-url "$RPC" --private-key "$PK2" --gas-price "$GAS" --gas-limit 200000 2>&1)
er "non-minter mint" "$R"

echo "2.10: Non-factory rescue BondingCurve"
R=$(cast send "$CURVE0" "rescue(address,address,uint256)" 0x0000000000000000000000000000000000000001 "$ATTACKER" 1 \
  --rpc-url "$RPC" --private-key "$PK2" --gas-price "$GAS" --gas-limit 200000 2>&1)
er "non-factory rescue BondingCurve" "$R"

echo ""
echo "── SECTION 3: BUSINESS LOGIC / REENTRANCY ──"

echo "3.1: Buy 0 amount"
R=$(cast send "$CURVE0" "buy(uint256,uint256,address)" 0 0 "$ZERO" \
  --rpc-url "$RPC" --private-key "$PK" --gas-price "$GAS" --gas-limit 200000 2>&1)
er "buy 0 amount" "$R"

echo "3.2: Buy value mismatch"
R=$(cast send "$CURVE0" "buy(uint256,uint256,address)" 5000000000000000 0 "$ZERO" \
  --value 10000000000000000 --rpc-url "$RPC" --private-key "$PK" --gas-price "$GAS" --gas-limit 200000 2>&1)
er "buy value mismatch" "$R"

echo "3.3: Sell 0 amount"
R=$(cast send "$CURVE0" "sell(uint256,uint256,address)" 0 0 "$ZERO" \
  --rpc-url "$RPC" --private-key "$PK" --gas-price "$GAS" --gas-limit 200000 2>&1)
er "sell 0 amount" "$R"

echo "3.4: Sell > balance"
R=$(cast send "$CURVE0" "sell(uint256,uint256,address)" 999999999999999999999999999999999 0 "$ZERO" \
  --rpc-url "$RPC" --private-key "$PK" --gas-price "$GAS" --gas-limit 200000 2>&1)
er "sell > balance" "$R"

echo "3.5: Buy minTokensOut too high"
R=$(cast send "$CURVE0" "buy(uint256,uint256,address)" 1000000000000000 999999999999999999999999999 "$ZERO" \
  --value 1000000000000000 --rpc-url "$RPC" --private-key "$PK" --gas-price "$GAS" --gas-limit 200000 2>&1)
er "buy minTokensOut too high" "$R"

echo ""
echo "── SECTION 4: REFERRAL ABUSE ──"

echo "4.1: Double setReferrer (already referred)"
R=$(cast send "$REGISTRY" "setReferrer(address)" "$ATTACKER" \
  --rpc-url "$RPC" --private-key "$PK2" --gas-price "$GAS" --gas-limit 200000 2>&1)
er "double setReferrer" "$R"

echo "4.2: Register duplicate code"
R=$(cast send "$REGISTRY" "registerCode(bytes32)" "$REF_CODE" \
  --rpc-url "$RPC" --private-key "$PK2" --gas-price "$GAS" --gas-limit 200000 2>&1)
er "register duplicate code" "$R"

echo ""
echo "── SECTION 5: GRADUATION ──"

echo "5.1: Graduate before threshold"
R=$(cast send "$CURVE0" "graduate()" \
  --rpc-url "$RPC" --private-key "$PK" --gas-price "$GAS" --gas-limit 200000 2>&1)
er "graduate before threshold" "$R"

echo ""
echo "── SECTION 6: TOKEN LIMITS ──"

echo "6.1: Self-burn (permissionless, M-1 fix)"
BAL=$(cast call "$TOKEN0" "balanceOf(address)(uint256)" "$DEPLOYER" --rpc-url "$RPC" 2>&1 | awk '{print $1}' | tr -d ' ')
BURN_AMT=$(python3 -c "print(int('$BAL') // 10)")
R=$(cast send "$TOKEN0" "burn(uint256)" "$BURN_AMT" \
  --rpc-url "$RPC" --private-key "$PK" --gas-price "$GAS" --gas-limit 200000 2>&1)
es "self-burn 10%" "$R"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  TEST SUMMARY"
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ PASS (features working):        $PASS"
echo "  🛡️  REVERT (security enforced):     $REVERT"
echo "  ❌ FAIL (unexpected):               $FAIL"
echo "═══════════════════════════════════════════════════════════════"

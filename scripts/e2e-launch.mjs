#!/usr/bin/env node
// Moon — Frontend E2E Launch + Buy test
// Mirrors the exact on-chain path the frontend uses:
//   1. createToken (same struct as useCreateToken.ts)
//   2. buy on the new bonding curve
//   3. Verify on-chain state
//   4. Verify backend indexer picked it up

import { createPublicClient, createWalletClient, http, parseEventLogs, parseAbi, formatEther, formatUnits, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

// ─── Config ───────────────────────────────────────────────────────
const RPC_URL  = 'https://sepolia.drpc.org';
const FACTORY  = '0xC3DadD2643a6aB9857880EF7Bf208dEdd31937b3';
const CHAIN_ID = 11155111;
const BACKEND  = 'http://localhost:4000';
if (!process.env.PRIV_KEY) { console.error('FATAL: PRIV_KEY env var required'); process.exit(1); }
const PK       = process.env.PRIV_KEY;

const account = privateKeyToAccount(PK);
console.log(`Wallet: ${account.address}`);

const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account, chain: sepolia, transport: http(RPC_URL) });

// ─── Minimal ABIs (matches frontend/src/abi/) ─────────────────────
const factoryAbi = [
  {
    type: 'function', name: 'createToken',
    inputs: [{
      name: 'params', type: 'tuple',
      components: [
        { name: 'name', type: 'string' },
        { name: 'symbol', type: 'string' },
        { name: 'imageUrl', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'maxTxBps', type: 'uint256' },
        { name: 'maxHoldBps', type: 'uint256' },
        { name: 'cooldownSeconds', type: 'uint256' },
        { name: 'supplyTier', type: 'uint8' },
        { name: 'curveShape', type: 'uint8' },
      ],
    }],
    outputs: [
      { name: 'token', type: 'address' },
      { name: 'curve', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event', name: 'TokenCreated',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'curve', type: 'address', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'symbol', type: 'string', indexed: false },
      { name: 'supplyTier', type: 'uint8', indexed: false },
      { name: 'curveShape', type: 'uint8', indexed: false },
      { name: 'totalSupply', type: 'uint256', indexed: false },
      { name: 'imageUrl', type: 'string', indexed: false },
      { name: 'description', type: 'string', indexed: false },
    ],
  },
];

const curveAbi = [
  {
    type: 'function', name: 'buy',
    inputs: [
      { name: 'quoteAmountIn', type: 'uint256' },
      { name: 'minTokensOut', type: 'uint256' },
      { name: 'referrer', type: 'address' },
    ],
    outputs: [{ name: 'tokensOut', type: 'uint256' }],
    stateMutability: 'payable',
  },
  { type: 'function', name: 'token', inputs: [], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 's_realTokenReserves', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 's_realQuoteReserves', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  {
    type: 'event', name: 'Bought',
    inputs: [
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'quoteIn', type: 'uint256', indexed: false },
      { name: 'tokensOut', type: 'uint256', indexed: false },
      { name: 'fee', type: 'uint256', indexed: false },
      { name: 'priceAfter', type: 'uint256', indexed: false },
    ],
  },
];

const tokenAbi = [
  { type: 'function', name: 'balanceOf', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'totalSupply', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'name', inputs: [], outputs: [{ name: '', type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'symbol', inputs: [], outputs: [{ name: '', type: 'string' }], stateMutability: 'view' },
];

// ─── Helpers ──────────────────────────────────────────────────────
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const PASS = '\x1b[32m✅ PASS\x1b[0m';
const FAIL = '\x1b[31m❌ FAIL\x1b[0m';

function log_pass(msg) { console.log(`  ${PASS} — ${msg}`); }
function log_fail(msg) { console.log(`  ${FAIL} — ${msg}`); FAILURES++; }
let FAILURES = 0;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Check balance ────────────────────────────────────────────────
async function checkBalance() {
  const bal = await publicClient.getBalance({ address: account.address });
  console.log(`Balance: ${formatEther(bal)} ETH`);
  if (bal < 20000000000000000n) {
    console.error('Insufficient balance for e2e (need ~0.02 ETH for createToken + buy)');
    process.exit(1);
  }
}

// ─── Step 1: Create token (mirrors useCreateToken.ts) ─────────────
async function createToken() {
  console.log('\n── STEP 1: CREATE TOKEN ──');

  const createArgs = {
    name: 'E2E Launch Test',
    symbol: 'E2E',
    imageUrl: 'https://Moon/e2e.png',
    description: 'End-to-end test token',
    maxTxBps: 100n,          // 1% max tx
    maxHoldBps: 500n,        // 5% max hold
    cooldownSeconds: 60n,
    supplyTier: 0,            // 1B tier
    curveShape: 1,            // EXPONENTIAL (pump.fun style)
  };

  console.log('  Sending createToken tx...');
  const hash = await walletClient.writeContract({
    abi: factoryAbi,
    address: FACTORY,
    functionName: 'createToken',
    args: [createArgs],
  });
  console.log(`  tx hash: https://sepolia.etherscan.io/tx/${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  status: ${receipt.status === 'success' ? 'success' : 'reverted'}`);

  if (receipt.status !== 'success') {
    log_fail('createToken reverted');
    return null;
  }

  // Parse TokenCreated event
  const parsed = parseEventLogs({ abi: factoryAbi, logs: receipt.logs });
  const tokenLog = parsed.find(l => l.eventName === 'TokenCreated');
  if (!tokenLog) {
    log_fail('TokenCreated event not found in receipt');
    return null;
  }

  const tokenAddr = tokenLog.args.token;
  const curveAddr = tokenLog.args.curve;
  const totalSupply = tokenLog.args.totalSupply;

  console.log(`  token:  ${tokenAddr}`);
  console.log(`  curve:  ${curveAddr}`);
  console.log(`  creator: ${tokenLog.args.creator}`);
  console.log(`  totalSupply: ${formatUnits(totalSupply, 18)}`);
  log_pass('createToken succeeded');
  return { tokenAddr, curveAddr, totalSupply, txHash: hash };
}

// ─── Step 2: Buy on the new curve ────────────────────────────────
async function buyTokens(curveAddr) {
  console.log('\n── STEP 2: BUY 0.01 ETH ──');

  const buyValue = BigInt('10000000000000000'); // 0.01 ETH

  console.log(`  Sending buy tx (value: 0.01 ETH)...`);
  const hash = await walletClient.writeContract({
    abi: curveAbi,
    address: curveAddr,
    functionName: 'buy',
    args: [buyValue, 0n, ZERO_ADDR],
    value: buyValue,
  });
  console.log(`  tx hash: https://sepolia.etherscan.io/tx/${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  status: ${receipt.status === 'success' ? 'success' : 'reverted'}`);

  if (receipt.status !== 'success') {
    log_fail('buy reverted');
    return null;
  }

  // Parse Bought event
  const parsed = parseEventLogs({ abi: curveAbi, logs: receipt.logs });
  const boughtLog = parsed.find(l => l.eventName === 'Bought');

  if (boughtLog) {
    const { buyer, quoteIn, tokensOut, fee, priceAfter } = boughtLog.args;
    console.log(`  buyer: ${buyer}`);
    console.log(`  quoteIn: ${formatEther(quoteIn)} ETH`);
    console.log(`  tokensOut: ${formatUnits(tokensOut, 18)}`);
    console.log(`  fee: ${formatUnits(fee, 18)}`);
    console.log(`  priceAfter: ${priceAfter}`);
  }

  log_pass('buy succeeded');
  return { txHash: hash, boughtLog };
}

// ─── Step 3: Verify on-chain state ───────────────────────────────
async function verifyOnChain(tokenAddr, curveAddr) {
  console.log('\n── STEP 3: VERIFY ON-CHAIN ──');

  const [balance, totalSupply, tokenName, tokenSymbol, curveTokenAddr, realTokenReserves, realQuoteReserves] =
    await publicClient.multicall({
      contracts: [
        { abi: tokenAbi, address: tokenAddr, functionName: 'balanceOf', args: [account.address] },
        { abi: tokenAbi, address: tokenAddr, functionName: 'totalSupply' },
        { abi: tokenAbi, address: tokenAddr, functionName: 'name' },
        { abi: tokenAbi, address: tokenAddr, functionName: 'symbol' },
        { abi: curveAbi, address: curveAddr, functionName: 'token' },
        { abi: curveAbi, address: curveAddr, functionName: 's_realTokenReserves' },
        { abi: curveAbi, address: curveAddr, functionName: 's_realQuoteReserves' },
      ],
    });

  console.log(`  token name: ${tokenName.result}`);
  console.log(`  token symbol: ${tokenSymbol.result}`);
  console.log(`  deployer balance: ${formatUnits(balance.result, 18)}`);
  console.log(`  totalSupply: ${formatUnits(totalSupply.result, 18)}`);
  console.log(`  curve.token: ${curveTokenAddr.result}`);
  console.log(`  curve.s_realTokenReserves: ${formatUnits(realTokenReserves.result, 18)}`);
  console.log(`  curve.s_realQuoteReserves: ${formatEther(realQuoteReserves.result)}`);

  if (balance.result > 0n) {
    log_pass('deployer holds tokens after buy');
  } else {
    log_fail('deployer balance is 0 after buy');
  }

  if (curveTokenAddr.result.toLowerCase() === tokenAddr.toLowerCase()) {
    log_pass('curve.token matches created token');
  } else {
    log_fail(`curve.token mismatch: ${curveTokenAddr.result} vs ${tokenAddr}`);
  }

  if (realTokenReserves.result > 0n) {
    log_pass('curve has token reserves (mint worked)');
  } else {
    log_fail('curve token reserves is 0');
  }

  if (realQuoteReserves.result > 0n) {
    log_pass('curve has quote reserves (ETH accepted)');
  } else {
    log_fail('curve quote reserves is 0');
  }
}

// ─── Step 4: Verify backend indexer ──────────────────────────────
async function verifyBackend(tokenAddr) {
  console.log('\n── STEP 4: VERIFY BACKEND INDEXER ──');

  const maxAttempts = 30;
  const intervalMs = 4000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${BACKEND}/api/tokens/${CHAIN_ID}/${tokenAddr}`);
      if (res.ok) {
        const token = await res.json();
        console.log(`  Backend found token: ${token.name} (${token.symbol}) at attempt ${attempt}`);
        log_pass('backend indexed token');

        // Check trades
        const tradeRes = await fetch(`${BACKEND}/api/tokens/${CHAIN_ID}/${tokenAddr}/trades`);
        if (tradeRes.ok) {
          const trades = await tradeRes.json();
          console.log(`  Backend indexed ${trades.length} trade(s)`);
          if (trades.length > 0) {
            log_pass('backend indexed trades');
          } else {
            log_fail('no trades in backend yet');
          }
        }
        return true;
      }
    } catch (e) {
      // Backend not ready yet
    }
    if (attempt < maxAttempts) {
      process.stdout.write(`  waiting for indexer... (${attempt}/${maxAttempts})\r`);
      await sleep(intervalMs);
    }
  }

  log_fail('backend did not index token after retries');
  return false;
}

// ─── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Moon — Frontend E2E Launch + Buy Test');
  console.log('═══════════════════════════════════════════════════════════════');

  await checkBalance();

  const created = await createToken();
  if (!created) { process.exit(1); }

  const bought = await buyTokens(created.curveAddr);
  if (!bought) { process.exit(1); }

  await verifyOnChain(created.tokenAddr, created.curveAddr);
  await verifyBackend(created.tokenAddr);

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  RESULTS: ${FAILURES === 0 ? 'ALL PASS' : `${FAILURES} FAILURE(S)`}`);
  console.log(`  Token: ${created.tokenAddr}`);
  console.log(`  Curve: ${created.curveAddr}`);
  console.log(`  Create tx: ${created.txHash}`);
  console.log(`  Buy tx:    ${bought.txHash}`);
  console.log('═══════════════════════════════════════════════════════════════');
  process.exit(FAILURES > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });

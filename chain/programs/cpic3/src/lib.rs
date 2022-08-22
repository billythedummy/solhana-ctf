#![cfg_attr(not(test), forbid(unsafe_code))]

use anchor_lang::prelude::CpiContext;
use solana_program::{
    account_info::AccountInfo, entrypoint, entrypoint::ProgramResult,
    pubkey::Pubkey,
};


entrypoint!(process_instruction);
fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    _instruction_data: &[u8],
) -> ProgramResult {
    let repay_amount = 0;

    let mut accounts_iter = accounts.into_iter();

    let player = accounts_iter.next().unwrap();
    let user = accounts_iter.next().unwrap();
    let state = accounts_iter.next().unwrap();
    let pool = accounts_iter.next().unwrap();
    let pool_account = accounts_iter.next().unwrap();
    let depositor_account = accounts_iter.next().unwrap();
    let token_program = accounts_iter.next().unwrap();
    let challenge3_progam = accounts_iter.next().unwrap();

    let cpi_accounts = challenge3::cpi::accounts::Repay {
        player: player.clone(),
        user: user.clone(),
        state: state.clone(),
        pool: pool.clone(),
        pool_account: pool_account.clone(),
        depositor_account: depositor_account.clone(),
        token_program: token_program.clone(),
    };
    challenge3::cpi::repay(CpiContext::new(challenge3_progam.clone(), cpi_accounts), repay_amount)?;
    Ok(())
}
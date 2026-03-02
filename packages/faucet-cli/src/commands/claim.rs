use serde_json::json;

use crate::api::claim_faucet;
use crate::errors::{CliError, EXIT_SUCCESS};
use crate::output::{print_error, print_success_human, print_success_json};
use crate::validation::parse_address;

const DEFAULT_CHAIN: &str = "zeko-testnet";

pub async fn run(address: &str, token: &str, as_json: bool) -> i32 {
    match execute(address, token, as_json).await {
        Ok(()) => EXIT_SUCCESS,
        Err(e) => {
            print_error(&e, as_json);
            e.exit_code
        }
    }
}

async fn execute(address: &str, token: &str, as_json: bool) -> Result<(), CliError> {
    let address = parse_address(address)?;
    let claim = claim_faucet(token, &address).await?;

    if as_json {
        let chain = if claim.chain.is_empty() {
            DEFAULT_CHAIN.to_string()
        } else {
            claim.chain.clone()
        };
        print_success_json(&json!({
            "success": true,
            "address": claim.address,
            "chain": chain,
            "amount": claim.amount,
            "hash": claim.hash,
            "explorer_url": claim.explorer_url,
        }));
    } else {
        print_success_human(&format!(
            "Claim submitted for {}.\nChain: {}\nAmount: {}\nTransaction: {}\nExplorer: {}",
            claim.address, claim.chain, claim.amount, claim.hash, claim.explorer_url
        ));
    }

    Ok(())
}

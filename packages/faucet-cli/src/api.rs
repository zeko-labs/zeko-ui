use reqwest::Client;
use serde::Deserialize;

use crate::errors::{CliError, EXIT_AUTH, EXIT_GENERAL, EXIT_INVALID_ADDRESS, EXIT_RATE_LIMITED};

const FAUCET_CLAIM_URL: &str = "https://api.faucet.zeko.io/claim";
const GITHUB_USER_URL: &str = "https://api.github.com/user";
const GITHUB_ACCEPT: &str = "application/vnd.github+json";
const GITHUB_USER_AGENT: &str = "zeko-faucet-cli";
const DEFAULT_CHAIN: &str = "zeko-testnet";

#[derive(Debug, Deserialize)]
pub struct GitHubUser {
    pub id: u64,
    pub login: String,
    pub name: Option<String>,
    pub html_url: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct FaucetClaim {
    #[allow(dead_code)]
    success: bool,
    pub hash: String,
    pub amount: String,
    pub address: String,
    pub chain: String,
    pub explorer_url: String,
}

#[derive(Debug, Deserialize)]
struct FaucetError {
    pub code: String,
    pub message: String,
}

pub async fn fetch_github_user(token: &str) -> Result<GitHubUser, CliError> {
    let client = Client::new();
    let response = client
        .get(GITHUB_USER_URL)
        .header("Accept", GITHUB_ACCEPT)
        .header("Authorization", format!("Bearer {token}"))
        .header("User-Agent", GITHUB_USER_AGENT)
        .send()
        .await
        .map_err(|e| {
            CliError::new(
                "request_failed",
                "GitHub verification is currently unavailable.",
                EXIT_GENERAL,
            )
            .with_details(&e.to_string())
        })?;

    let status = response.status().as_u16();
    let rate_remaining = response
        .headers()
        .get("x-ratelimit-remaining")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if status == 429 || (status == 403 && rate_remaining == "0") {
        return Err(CliError::new(
            "github_rate_limited",
            "GitHub rate limited this token. Try again later.",
            EXIT_RATE_LIMITED,
        ));
    }

    if status == 401 || status == 403 {
        return Err(CliError::new(
            "github_auth_failed",
            "Failed to verify the provided GitHub token.",
            EXIT_AUTH,
        ));
    }

    if !response.status().is_success() {
        return Err(CliError::new(
            "github_request_failed",
            &format!("GitHub verification failed with status {status}."),
            EXIT_GENERAL,
        ));
    }

    response.json::<GitHubUser>().await.map_err(|_| {
        CliError::new(
            "invalid_response",
            "GitHub verification returned an unexpected response.",
            EXIT_GENERAL,
        )
    })
}

pub async fn claim_faucet(token: &str, address: &str) -> Result<FaucetClaim, CliError> {
    let client = Client::new();
    let response = client
        .post(FAUCET_CLAIM_URL)
        .header("Authorization", format!("Bearer {token}"))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "address": address,
            "chain": DEFAULT_CHAIN,
        }))
        .send()
        .await
        .map_err(|e| {
            CliError::new(
                "request_failed",
                "The faucet service is currently unavailable.",
                EXIT_GENERAL,
            )
            .with_details(&e.to_string())
        })?;

    let status = response.status().as_u16();

    if response.status().is_success() {
        return response.json::<FaucetClaim>().await.map_err(|_| {
            CliError::new(
                "invalid_response",
                "The faucet service returned an unexpected response.",
                EXIT_GENERAL,
            )
        });
    }

    let body = response.text().await.unwrap_or_default();
    let error_result = serde_json::from_str::<FaucetError>(&body);
    let fallback_message = format!("Claim failed with status {status}.");
    let (error_code, message) = match &error_result {
        Ok(e) => (e.code.as_str(), e.message.as_str()),
        Err(_) => ("claim_failed", fallback_message.as_str()),
    };

    if status == 400 && error_code == "invalid_address" {
        return Err(CliError::new(error_code, message, EXIT_INVALID_ADDRESS));
    }

    if status == 429 || error_code.ends_with("rate_limited") {
        return Err(CliError::new(error_code, message, EXIT_RATE_LIMITED));
    }

    if status == 401 || error_code == "missing_github_token" {
        return Err(CliError::new(error_code, message, EXIT_AUTH));
    }

    if status == 403
        && ["github_verification_failed", "github_account_too_new", "missing_github_token"]
            .contains(&error_code)
    {
        return Err(CliError::new(error_code, message, EXIT_AUTH));
    }

    Err(CliError::new(error_code, message, EXIT_GENERAL))
}

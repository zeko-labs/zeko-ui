use regex::Regex;

use crate::errors::{CliError, EXIT_INVALID_ADDRESS};

pub fn parse_address(value: &str) -> Result<String, CliError> {
    let trimmed = value.trim();
    let re = Regex::new(r"^B62[1-9A-HJ-NP-Za-km-z]{52}$").unwrap();

    if trimmed.is_empty() || !re.is_match(trimmed) {
        return Err(CliError::new(
            "invalid_address",
            "Address must be a valid Mina public key.",
            EXIT_INVALID_ADDRESS,
        ));
    }

    Ok(trimmed.to_string())
}

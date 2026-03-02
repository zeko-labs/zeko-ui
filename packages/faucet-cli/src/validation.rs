use regex::Regex;

use crate::errors::{CliError, EXIT_INVALID_ADDRESS};

pub fn parse_address(value: &str) -> Result<String, CliError> {
    let trimmed = value.trim();
    let re = Regex::new(r"^[a-zA-Z0-9]+$").unwrap();

    if trimmed.is_empty() || !re.is_match(trimmed) {
        return Err(CliError::new(
            "invalid_address",
            "Address must be a non-empty alphanumeric string.",
            EXIT_INVALID_ADDRESS,
        ));
    }

    Ok(trimmed.to_string())
}

use serde::Serialize;

pub const EXIT_SUCCESS: i32 = 0;
pub const EXIT_GENERAL: i32 = 1;
pub const EXIT_AUTH: i32 = 2;
pub const EXIT_RATE_LIMITED: i32 = 3;
pub const EXIT_INVALID_ADDRESS: i32 = 4;

#[derive(Debug, Serialize)]
pub struct CliError {
    pub code: String,
    pub message: String,
    #[serde(skip)]
    pub exit_code: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

impl CliError {
    pub fn new(code: &str, message: &str, exit_code: i32) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            exit_code,
            details: None,
        }
    }

    pub fn with_details(mut self, details: &str) -> Self {
        self.details = Some(details.to_string());
        self
    }
}

impl std::fmt::Display for CliError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for CliError {}

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "zeko-faucet", version, about = "CLI for the public Zeko faucet API")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Claim faucet tokens for an address
    Claim {
        /// Positional arguments (first is address, rest are extra)
        #[arg(num_args = 0..)]
        args: Vec<String>,
        /// GitHub token. Falls back to GITHUB_TOKEN.
        #[arg(long, env = "GITHUB_TOKEN")]
        token: String,
        /// Emit machine-readable JSON.
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    /// Verify the current GitHub token and show the associated user
    Whoami {
        /// Unexpected positional arguments
        #[arg(hide = true, num_args = 0..)]
        args: Vec<String>,
        /// GitHub token. Falls back to GITHUB_TOKEN.
        #[arg(long, env = "GITHUB_TOKEN")]
        token: String,
        /// Emit machine-readable JSON.
        #[arg(long, default_value_t = false)]
        json: bool,
    },
}

mod api;
mod cli;
mod commands;
mod errors;
mod output;
mod validation;

use clap::Parser;
use errors::{CliError, EXIT_GENERAL};
use output::print_error;

#[tokio::main]
async fn main() {
    let cli = cli::Cli::parse();
    let exit_code = match cli.command {
        cli::Commands::Claim { args, token, json } => {
            if args.len() > 1 {
                let err = CliError::new(
                    "invalid_arguments",
                    "claim accepts exactly one address argument.",
                    EXIT_GENERAL,
                );
                print_error(&err, json);
                EXIT_GENERAL
            } else {
                let address = args.first().map(|s| s.as_str()).unwrap_or("");
                commands::claim::run(address, &token, json).await
            }
        }
        cli::Commands::Whoami { args, token, json } => {
            if !args.is_empty() {
                let err = CliError::new(
                    "invalid_arguments",
                    "whoami does not accept positional arguments.",
                    EXIT_GENERAL,
                );
                print_error(&err, json);
                EXIT_GENERAL
            } else {
                let source = if std::env::var("GITHUB_TOKEN").is_ok_and(|v| !v.is_empty()) {
                    "env"
                } else {
                    "flag"
                };
                commands::whoami::run(&token, json, source).await
            }
        }
    };
    std::process::exit(exit_code);
}

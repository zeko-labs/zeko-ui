use serde_json::json;

use crate::api::fetch_github_user;
use crate::errors::{CliError, EXIT_SUCCESS};
use crate::output::{print_error, print_success_human, print_success_json};

pub async fn run(token: &str, as_json: bool, token_source: &str) -> i32 {
    match execute(token, as_json, token_source).await {
        Ok(()) => EXIT_SUCCESS,
        Err(e) => {
            print_error(&e, as_json);
            e.exit_code
        }
    }
}

async fn execute(token: &str, as_json: bool, token_source: &str) -> Result<(), CliError> {
    let user = fetch_github_user(token).await?;

    if as_json {
        print_success_json(&json!({
            "success": true,
            "id": user.id,
            "login": user.login,
            "name": user.name,
            "html_url": user.html_url,
            "created_at": user.created_at,
            "token_source": token_source,
        }));
    } else {
        let mut lines = vec![
            format!("Authenticated as {} (#{}). ", user.login, user.id),
        ];
        if let Some(name) = &user.name {
            lines.push(format!("Name: {name}"));
        }
        lines.push(format!("Profile: {}", user.html_url));
        lines.push(format!("Created: {}", user.created_at));
        lines.push(format!("Token source: {token_source}"));
        print_success_human(&lines.join("\n"));
    }

    Ok(())
}

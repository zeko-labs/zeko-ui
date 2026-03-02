use serde_json::{json, Value};

use crate::errors::CliError;

pub fn print_success_human(text: &str) {
    println!("{text}");
}

pub fn print_success_json(payload: &Value) {
    println!("{}", serde_json::to_string_pretty(payload).unwrap());
}

pub fn print_error(error: &CliError, as_json: bool) {
    let mut payload = json!({
        "success": false,
        "code": error.code,
        "message": error.message,
    });

    if let Some(details) = &error.details {
        payload["details"] = json!(details);
    }

    if as_json {
        println!("{}", serde_json::to_string_pretty(&payload).unwrap());
    } else {
        eprintln!("Error: {}", error.message);
    }
}

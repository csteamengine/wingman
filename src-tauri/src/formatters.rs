use std::process::{Command, Stdio};
use std::io::Write;

// Helper to run formatter via node
fn run_node_formatter(text: &str, formatter: &str, args: &[&str]) -> Result<String, String> {
    use std::path::PathBuf;

    // Try multiple paths to find node_modules
    let possible_paths = vec![
        // Development: from cargo workspace
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().map(|p| p.to_path_buf()),
        // Production: from app resources
        std::env::current_exe()
            .ok()
            .and_then(|exe| exe.parent().and_then(|p| p.parent()).and_then(|p| p.parent()).map(|p| p.to_path_buf())),
        // Current directory
        std::env::current_dir().ok(),
    ];

    let mut formatter_path = None;
    for base_path in possible_paths.iter().flatten() {
        let candidate = base_path.join("node_modules").join(".bin").join(formatter);
        if candidate.exists() {
            formatter_path = Some(candidate);
            break;
        }
    }

    let formatter_path = formatter_path
        .ok_or_else(|| {
            let searched: Vec<String> = possible_paths
                .iter()
                .flatten()
                .map(|p| p.join("node_modules/.bin").join(formatter).display().to_string())
                .collect();
            format!(
                "Could not find {} in node_modules. Searched:\n  {}\nPlease run 'pnpm install' in the project directory.",
                formatter,
                searched.join("\n  ")
            )
        })?;

    let mut child = Command::new(&formatter_path)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn {}: {}. Make sure dependencies are installed.", formatter, e))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(text.as_bytes())
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
    }

    let output = child.wait_with_output()
        .map_err(|e| format!("Failed to wait for {}: {}", formatter, e))?;

    if output.status.success() {
        String::from_utf8(output.stdout)
            .map_err(|e| format!("Invalid UTF-8 output: {}", e))
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("Formatter error: {}", error))
    }
}

pub fn format_javascript_code(text: String) -> Result<String, String> {
    // Use Prettier for JavaScript/TypeScript/JSX/TSX formatting
    run_node_formatter(&text, "prettier", &["--parser", "babel", "--print-width", "100", "--tab-width", "2"])
}

pub fn format_react_code(text: String) -> Result<String, String> {
    // Detect if it's TypeScript by looking for type annotations
    let is_typescript = text.contains(": ") && (
        text.contains("interface ") ||
        text.contains("type ") ||
        text.contains("enum ") ||
        text.contains("<FC<") ||
        text.contains("React.FC<") ||
        text.contains("React.Component<") ||
        text.contains("FunctionComponent<") ||
        text.contains(": FC<")
    );

    let parser = if is_typescript { "typescript" } else { "babel" };

    // Use Prettier with appropriate parser for React code
    run_node_formatter(&text, "prettier", &["--parser", parser, "--print-width", "100", "--tab-width", "2"])
}

pub fn format_html_code(text: String) -> Result<String, String> {
    // Use Prettier for HTML formatting
    run_node_formatter(&text, "prettier", &["--parser", "html", "--print-width", "100", "--tab-width", "2"])
}

pub fn format_css_code(text: String) -> Result<String, String> {
    // Use Prettier for CSS formatting
    run_node_formatter(&text, "prettier", &["--parser", "css", "--print-width", "100", "--tab-width", "2"])
}

pub fn format_json_code(text: String) -> Result<String, String> {
    // Use Prettier for JSON formatting
    run_node_formatter(&text, "prettier", &["--parser", "json", "--print-width", "100", "--tab-width", "2"])
}

pub fn format_sql_code(text: String) -> Result<String, String> {
    use std::path::PathBuf;

    // Try multiple paths to find node_modules
    let possible_paths = vec![
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().map(|p| p.to_path_buf()),
        std::env::current_exe()
            .ok()
            .and_then(|exe| exe.parent().and_then(|p| p.parent()).and_then(|p| p.parent()).map(|p| p.to_path_buf())),
        std::env::current_dir().ok(),
    ];

    let mut formatter_path = None;
    for base_path in possible_paths.iter().flatten() {
        let candidate = base_path.join("node_modules").join(".bin").join("sql-formatter");
        if candidate.exists() {
            formatter_path = Some(candidate);
            break;
        }
    }

    let formatter_path = formatter_path
        .ok_or_else(|| {
            let searched: Vec<String> = possible_paths
                .iter()
                .flatten()
                .map(|p| p.join("node_modules/.bin/sql-formatter").display().to_string())
                .collect();
            format!(
                "Could not find sql-formatter in node_modules. Searched:\n  {}\nPlease run 'pnpm install' in the project directory.",
                searched.join("\n  ")
            )
        })?;

    let mut child = Command::new(&formatter_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn sql-formatter: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(text.as_bytes())
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
    }

    let output = child.wait_with_output()
        .map_err(|e| format!("Failed to wait for sql-formatter: {}", e))?;

    if output.status.success() {
        String::from_utf8(output.stdout)
            .map_err(|e| format!("Invalid UTF-8 output: {}", e))
    } else {
        // Fall back to original text if formatting fails
        Ok(text)
    }
}

pub fn format_python_code(text: String) -> Result<String, String> {
    // Try to use autopep8 if available, otherwise black
    let mut child = match Command::new("autopep8")
        .arg("-")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn() {
            Ok(c) => c,
            Err(_) => {
                // autopep8 not available, try black
                match Command::new("black")
                    .args(&["-", "--quiet"])
                    .stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn() {
                        Ok(c) => c,
                        Err(_) => {
                            // No Python formatter available, return as-is
                            return Ok(text);
                        }
                    }
            }
        };

    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(text.as_bytes());
    }

    let output = child.wait_with_output()
        .map_err(|e| format!("Failed to format Python: {}", e))?;

    if output.status.success() {
        String::from_utf8(output.stdout)
            .map_err(|e| format!("Invalid UTF-8 output: {}", e))
    } else {
        // If formatter fails, return original
        Ok(text)
    }
}

pub fn minify_json_code(text: String) -> Result<String, String> {
    let parsed: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    serde_json::to_string(&parsed)
        .map_err(|e| format!("Failed to minify JSON: {}", e))
}

fn remove_js_comments(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut result = String::new();
    let mut i = 0;
    let mut in_string = false;
    let mut string_char = ' ';
    let mut in_regex = false;

    while i < chars.len() {
        let ch = chars[i];

        // Handle escape sequences in strings
        if in_string && ch == '\\' && i + 1 < chars.len() {
            result.push(ch);
            result.push(chars[i + 1]);
            i += 2;
            continue;
        }

        // Handle strings and template literals
        if (ch == '"' || ch == '\'' || ch == '`') && !in_regex {
            if !in_string {
                in_string = true;
                string_char = ch;
            } else if ch == string_char {
                in_string = false;
            }
            result.push(ch);
            i += 1;
            continue;
        }

        if in_string {
            result.push(ch);
            i += 1;
            continue;
        }

        // Handle single-line comments
        if ch == '/' && i + 1 < chars.len() && chars[i + 1] == '/' {
            // Skip until end of line
            i += 2;
            while i < chars.len() && chars[i] != '\n' {
                i += 1;
            }
            // Keep the newline if there is one
            if i < chars.len() && chars[i] == '\n' {
                result.push('\n');
                i += 1;
            }
            continue;
        }

        // Handle multi-line comments
        if ch == '/' && i + 1 < chars.len() && chars[i + 1] == '*' {
            // Skip until */
            i += 2;
            while i < chars.len() - 1 {
                if chars[i] == '*' && chars[i + 1] == '/' {
                    i += 2;
                    break;
                }
                i += 1;
            }
            // Add a space to avoid joining tokens
            result.push(' ');
            continue;
        }

        // Regular character
        result.push(ch);
        i += 1;
    }

    result
}

pub fn minify_react_code(text: String) -> Result<String, String> {
    // Detect if it's TypeScript
    let is_typescript = text.contains(": ") && (
        text.contains("interface ") ||
        text.contains("type ") ||
        text.contains("enum ") ||
        text.contains("<FC<") ||
        text.contains("React.FC<") ||
        text.contains("React.Component<") ||
        text.contains("FunctionComponent<") ||
        text.contains(": FC<")
    );

    let parser = if is_typescript { "typescript" } else { "babel" };

    // First remove comments
    let without_comments = remove_js_comments(&text);

    // Use Prettier with maximum line width then collapse whitespace
    match run_node_formatter(&without_comments, "prettier", &["--parser", parser, "--print-width", "99999"]) {
        Ok(formatted) => {
            // Remove newlines and extra spaces while preserving strings
            let mut result = String::new();
            let mut in_string = false;
            let mut string_char = ' ';
            let mut last_was_space = false;

            for ch in formatted.chars() {
                if (ch == '"' || ch == '\'' || ch == '`') {
                    if !in_string {
                        in_string = true;
                        string_char = ch;
                    } else if ch == string_char {
                        in_string = false;
                    }
                    result.push(ch);
                    last_was_space = false;
                    continue;
                }

                if in_string {
                    result.push(ch);
                    last_was_space = false;
                    continue;
                }

                if ch.is_whitespace() {
                    if !last_was_space {
                        result.push(' ');
                        last_was_space = true;
                    }
                } else {
                    result.push(ch);
                    last_was_space = false;
                }
            }

            Ok(result.trim().to_string())
        },
        Err(_) => Ok(text),
    }
}

pub fn minify_javascript_code(text: String) -> Result<String, String> {
    // First remove comments
    let without_comments = remove_js_comments(&text);

    // Use Prettier with maximum line width then collapse whitespace
    match run_node_formatter(&without_comments, "prettier", &["--parser", "babel", "--print-width", "99999"]) {
        Ok(formatted) => {
            // Remove newlines and extra spaces while preserving strings
            let mut result = String::new();
            let mut in_string = false;
            let mut string_char = ' ';
            let mut last_was_space = false;

            for ch in formatted.chars() {
                if (ch == '"' || ch == '\'' || ch == '`') {
                    if !in_string {
                        in_string = true;
                        string_char = ch;
                    } else if ch == string_char {
                        in_string = false;
                    }
                    result.push(ch);
                    last_was_space = false;
                    continue;
                }

                if in_string {
                    result.push(ch);
                    last_was_space = false;
                    continue;
                }

                if ch.is_whitespace() {
                    if !last_was_space {
                        result.push(' ');
                        last_was_space = true;
                    }
                } else {
                    result.push(ch);
                    last_was_space = false;
                }
            }

            Ok(result.trim().to_string())
        },
        Err(_) => Ok(text),
    }
}

fn remove_css_comments(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut result = String::new();
    let mut i = 0;

    while i < chars.len() {
        let ch = chars[i];

        // Handle CSS comments /* */
        if ch == '/' && i + 1 < chars.len() && chars[i + 1] == '*' {
            // Skip until */
            i += 2;
            while i < chars.len() - 1 {
                if chars[i] == '*' && chars[i + 1] == '/' {
                    i += 2;
                    break;
                }
                i += 1;
            }
            // Add a space to avoid joining tokens
            result.push(' ');
            continue;
        }

        // Regular character
        result.push(ch);
        i += 1;
    }

    result
}

pub fn minify_css_code(text: String) -> Result<String, String> {
    // First remove comments
    let without_comments = remove_css_comments(&text);

    // Use Prettier with no formatting to minify CSS
    match run_node_formatter(&without_comments, "prettier", &["--parser", "css", "--print-width", "99999"]) {
        Ok(formatted) => {
            // Remove newlines and extra spaces
            let minified = formatted
                .lines()
                .map(|l| l.trim())
                .collect::<Vec<_>>()
                .join("");
            Ok(minified)
        },
        Err(_) => Ok(text),
    }
}

fn remove_html_comments(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut result = String::new();
    let mut i = 0;

    while i < chars.len() {
        // Handle HTML comments <!-- -->
        if i + 3 < chars.len() && chars[i] == '<' && chars[i + 1] == '!' && chars[i + 2] == '-' && chars[i + 3] == '-' {
            // Skip until -->
            i += 4;
            while i < chars.len() - 2 {
                if chars[i] == '-' && chars[i + 1] == '-' && chars[i + 2] == '>' {
                    i += 3;
                    break;
                }
                i += 1;
            }
            continue;
        }

        // Regular character
        result.push(chars[i]);
        i += 1;
    }

    result
}

pub fn minify_html_code(text: String) -> Result<String, String> {
    // First remove comments
    let without_comments = remove_html_comments(&text);

    // Use Prettier with max line width then collapse whitespace
    match run_node_formatter(&without_comments, "prettier", &["--parser", "html", "--print-width", "99999"]) {
        Ok(formatted) => {
            // Remove newlines and collapse whitespace
            let mut result = String::new();
            let mut in_tag = false;
            let mut last_was_space = false;

            for ch in formatted.chars() {
                if ch == '<' {
                    in_tag = true;
                    result.push(ch);
                    last_was_space = false;
                } else if ch == '>' {
                    in_tag = false;
                    result.push(ch);
                    last_was_space = false;
                } else if in_tag {
                    result.push(ch);
                } else if ch.is_whitespace() {
                    if !last_was_space {
                        result.push(' ');
                        last_was_space = true;
                    }
                } else {
                    result.push(ch);
                    last_was_space = false;
                }
            }

            Ok(result.trim().to_string())
        },
        Err(_) => Ok(text),
    }
}

// Go formatting
pub fn format_go_code(text: String) -> Result<String, String> {
    let mut child = Command::new("gofmt")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| "Go formatter (gofmt) not found. Please install Go to format Go code.".to_string())?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(text.as_bytes())
            .map_err(|e| format!("Failed to write to gofmt: {}", e))?;
    }

    let output = child.wait_with_output()
        .map_err(|e| format!("Failed to wait for gofmt: {}", e))?;

    if output.status.success() {
        String::from_utf8(output.stdout)
            .map_err(|e| format!("Invalid UTF-8 output from gofmt: {}", e))
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("gofmt error: {}", error))
    }
}

// Rust formatting
pub fn format_rust_code(text: String) -> Result<String, String> {
    let mut child = Command::new("rustfmt")
        .arg("--emit=stdout")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| "Rust formatter (rustfmt) not found. Please install Rust to format Rust code.".to_string())?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(text.as_bytes())
            .map_err(|e| format!("Failed to write to rustfmt: {}", e))?;
    }

    let output = child.wait_with_output()
        .map_err(|e| format!("Failed to wait for rustfmt: {}", e))?;

    if output.status.success() {
        String::from_utf8(output.stdout)
            .map_err(|e| format!("Invalid UTF-8 output from rustfmt: {}", e))
    } else {
        // rustfmt might fail on incomplete code, return original
        Ok(text)
    }
}

// Java formatting
pub fn format_java_code(text: String) -> Result<String, String> {
    // Try Prettier with Java plugin
    match run_node_formatter(&text, "prettier", &["--parser", "java", "--print-width", "100", "--tab-width", "4"]) {
        Ok(formatted) => Ok(formatted),
        Err(_) => Err("Java formatting requires Prettier with Java plugin. Run: pnpm add -D prettier-plugin-java".to_string()),
    }
}

// PHP formatting
pub fn format_php_code(text: String) -> Result<String, String> {
    // Try Prettier with PHP plugin
    match run_node_formatter(&text, "prettier", &["--parser", "php", "--print-width", "100", "--tab-width", "4"]) {
        Ok(formatted) => Ok(formatted),
        Err(_) => Err("PHP formatting requires Prettier with PHP plugin. Run: pnpm add -D @prettier/plugin-php".to_string()),
    }
}

// Ruby formatting
pub fn format_ruby_code(text: String) -> Result<String, String> {
    // Try rubocop with auto-correct
    let mut child = Command::new("rubocop")
        .args(&["--auto-correct", "--stdin", "temp.rb", "--format", "quiet"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();

    match child {
        Ok(mut child_proc) => {
            if let Some(mut stdin) = child_proc.stdin.take() {
                let _ = stdin.write_all(text.as_bytes());
            }

            let output = child_proc.wait_with_output()
                .map_err(|e| format!("Failed to wait for rubocop: {}", e))?;

            if output.status.success() || output.status.code() == Some(1) {
                // Rubocop returns exit code 1 if it made corrections
                let formatted = String::from_utf8(output.stdout)
                    .unwrap_or(text.clone());
                if !formatted.trim().is_empty() {
                    Ok(formatted)
                } else {
                    Ok(text)
                }
            } else {
                Ok(text)
            }
        },
        Err(_) => Err("Ruby formatter (rubocop) not found. Install with: gem install rubocop".to_string()),
    }
}

// Swift formatting
pub fn format_swift_code(text: String) -> Result<String, String> {
    let mut child = Command::new("swift-format")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();

    match child {
        Ok(mut child_proc) => {
            if let Some(mut stdin) = child_proc.stdin.take() {
                stdin.write_all(text.as_bytes())
                    .map_err(|e| format!("Failed to write to swift-format: {}", e))?;
            }

            let output = child_proc.wait_with_output()
                .map_err(|e| format!("Failed to wait for swift-format: {}", e))?;

            if output.status.success() {
                String::from_utf8(output.stdout)
                    .map_err(|e| format!("Invalid UTF-8 output: {}", e))
            } else {
                Ok(text)
            }
        },
        Err(_) => Err("Swift formatter (swift-format) not found. Install from: https://github.com/apple/swift-format".to_string()),
    }
}

// Kotlin formatting
pub fn format_kotlin_code(text: String) -> Result<String, String> {
    // Try ktlint
    let mut child = Command::new("ktlint")
        .args(&["--format", "--stdin"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();

    match child {
        Ok(mut child_proc) => {
            if let Some(mut stdin) = child_proc.stdin.take() {
                let _ = stdin.write_all(text.as_bytes());
            }

            let output = child_proc.wait_with_output()
                .map_err(|e| format!("Failed to wait for ktlint: {}", e))?;

            if output.status.success() {
                Ok(String::from_utf8(output.stdout)
                    .unwrap_or(text.clone()))
            } else {
                Ok(text)
            }
        },
        Err(_) => Err("Kotlin formatter (ktlint) not found. Install from: https://github.com/pinterest/ktlint".to_string()),
    }
}

// C# formatting
pub fn format_csharp_code(text: String) -> Result<String, String> {
    // Try dotnet format (requires a temp file)
    use std::fs;
    use std::path::PathBuf;

    let temp_dir = std::env::temp_dir();
    let temp_file = temp_dir.join("wingman_temp.cs");

    fs::write(&temp_file, &text)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    let output = Command::new("dotnet")
        .args(&["format", "--include", temp_file.to_str().unwrap()])
        .output();

    match output {
        Ok(out) => {
            if out.status.success() {
                match fs::read_to_string(&temp_file) {
                    Ok(formatted) => {
                        let _ = fs::remove_file(temp_file);
                        Ok(formatted)
                    },
                    Err(_) => {
                        let _ = fs::remove_file(temp_file);
                        Ok(text)
                    }
                }
            } else {
                let _ = fs::remove_file(temp_file);
                Ok(text)
            }
        },
        Err(_) => {
            let _ = fs::remove_file(&temp_file);
            Err("C# formatter (dotnet format) not found. Install .NET SDK from: https://dotnet.microsoft.com".to_string())
        }
    }
}

// Bash formatting
pub fn format_bash_code(text: String) -> Result<String, String> {
    let child = Command::new("shfmt")
        .args(&["-i", "2"]) // 2 space indent
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();

    match child {
        Ok(mut child_proc) => {
            if let Some(mut stdin) = child_proc.stdin.take() {
                stdin.write_all(text.as_bytes())
                    .map_err(|e| format!("Failed to write to shfmt: {}", e))?;
            }

            let output = child_proc.wait_with_output()
                .map_err(|e| format!("Failed to wait for shfmt: {}", e))?;

            if output.status.success() {
                String::from_utf8(output.stdout)
                    .map_err(|e| format!("Invalid UTF-8 output: {}", e))
            } else {
                Ok(text)
            }
        },
        Err(_) => Err("Bash formatter (shfmt) not found. Install from: https://github.com/mvdan/sh".to_string()),
    }
}

// C/C++ formatting
pub fn format_c_cpp_code(text: String) -> Result<String, String> {
    let child = Command::new("clang-format")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();

    match child {
        Ok(mut child_proc) => {
            if let Some(mut stdin) = child_proc.stdin.take() {
                stdin.write_all(text.as_bytes())
                    .map_err(|e| format!("Failed to write to clang-format: {}", e))?;
            }

            let output = child_proc.wait_with_output()
                .map_err(|e| format!("Failed to wait for clang-format: {}", e))?;

            if output.status.success() {
                String::from_utf8(output.stdout)
                    .map_err(|e| format!("Invalid UTF-8 output: {}", e))
            } else {
                Ok(text)
            }
        },
        Err(_) => Err("C/C++ formatter (clang-format) not found. Install LLVM/Clang from: https://clang.llvm.org".to_string()),
    }
}

// Markdown formatting
pub fn format_markdown_code(text: String) -> Result<String, String> {
    // Use Prettier for Markdown formatting
    run_node_formatter(&text, "prettier", &["--parser", "markdown", "--print-width", "100", "--prose-wrap", "always"])
}

// XML minify
pub fn minify_xml_code(text: String) -> Result<String, String> {
    // Remove comments and collapse whitespace
    let mut result = String::new();
    let mut in_tag = false;
    let mut in_comment = false;
    let chars: Vec<char> = text.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        // Check for comment start
        if i + 3 < chars.len() && chars[i] == '<' && chars[i+1] == '!' && chars[i+2] == '-' && chars[i+3] == '-' {
            in_comment = true;
            i += 4;
            continue;
        }

        // Check for comment end
        if in_comment && i + 2 < chars.len() && chars[i] == '-' && chars[i+1] == '-' && chars[i+2] == '>' {
            in_comment = false;
            i += 3;
            continue;
        }

        if in_comment {
            i += 1;
            continue;
        }

        if chars[i] == '<' {
            in_tag = true;
            result.push(chars[i]);
        } else if chars[i] == '>' {
            in_tag = false;
            result.push(chars[i]);
        } else if in_tag {
            result.push(chars[i]);
        } else if !chars[i].is_whitespace() {
            result.push(chars[i]);
        }

        i += 1;
    }

    Ok(result)
}

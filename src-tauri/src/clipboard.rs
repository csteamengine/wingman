use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextStats {
    pub character_count: usize,
    pub word_count: usize,
    pub line_count: usize,
    pub paragraph_count: usize,
}

pub fn calculate_text_stats(text: &str) -> TextStats {
    let character_count = text.chars().count();
    let word_count = text.split_whitespace().count();
    let line_count = if text.is_empty() {
        0
    } else {
        text.lines().count()
    };

    // Count paragraphs (separated by blank lines)
    let paragraph_count = text
        .split("\n\n")
        .filter(|p| !p.trim().is_empty())
        .count();

    TextStats {
        character_count,
        word_count,
        line_count,
        paragraph_count,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TextTransform {
    Uppercase,
    Lowercase,
    TitleCase,
    SentenceCase,
    CamelCase,
    SnakeCase,
    KebabCase,
    TrimWhitespace,
    SortLines,
    RemoveDuplicateLines,
    ReverseLines,
    BulletList,
}

pub fn transform_text(text: &str, transform: TextTransform) -> String {
    match transform {
        TextTransform::Uppercase => text.to_uppercase(),
        TextTransform::Lowercase => text.to_lowercase(),
        TextTransform::TitleCase => to_title_case(text),
        TextTransform::SentenceCase => to_sentence_case(text),
        TextTransform::CamelCase => text
            .lines()
            .map(|line| to_camel_case(line))
            .collect::<Vec<_>>()
            .join("\n"),
        TextTransform::SnakeCase => text
            .lines()
            .map(|line| to_snake_case(line))
            .collect::<Vec<_>>()
            .join("\n"),
        TextTransform::KebabCase => text
            .lines()
            .map(|line| to_kebab_case(line))
            .collect::<Vec<_>>()
            .join("\n"),
        TextTransform::TrimWhitespace => text
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .collect::<Vec<_>>()
            .join("\n"),
        TextTransform::SortLines => {
            let mut lines: Vec<&str> = text.lines().collect();
            lines.sort();
            lines.join("\n")
        }
        TextTransform::RemoveDuplicateLines => {
            let mut seen = std::collections::HashSet::new();
            text.lines()
                .filter(|line| seen.insert(*line))
                .collect::<Vec<_>>()
                .join("\n")
        }
        TextTransform::ReverseLines => {
            let lines: Vec<&str> = text.lines().collect();
            lines.into_iter().rev().collect::<Vec<_>>().join("\n")
        }
        TextTransform::BulletList => {
            if text.is_empty() {
                // Start a new bulleted list
                "• ".to_string()
            } else {
                text.lines()
                    .map(|line| {
                        if line.trim().is_empty() {
                            line.to_string()
                        } else if line.trim_start().starts_with("• ") {
                            // Already has bullet, keep as-is
                            line.to_string()
                        } else {
                            format!("• {}", line)
                        }
                    })
                    .collect::<Vec<_>>()
                    .join("\n")
            }
        }
    }
}

fn to_title_case(text: &str) -> String {
    text.split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str().to_lowercase().as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn to_sentence_case(text: &str) -> String {
    let mut result = String::new();
    let mut capitalize_next = true;

    for c in text.chars() {
        if capitalize_next && c.is_alphabetic() {
            result.push_str(&c.to_uppercase().to_string());
            capitalize_next = false;
        } else {
            result.push(c.to_lowercase().next().unwrap_or(c));
        }

        if c == '.' || c == '!' || c == '?' {
            capitalize_next = true;
        }
    }

    result
}

/// Split text into words, handling camelCase, snake_case, kebab-case, and spaces
fn split_into_words(text: &str) -> Vec<String> {
    let mut words = Vec::new();
    let mut current_word = String::new();

    for c in text.chars() {
        if c == '_' || c == '-' || c.is_whitespace() {
            if !current_word.is_empty() {
                words.push(current_word.to_lowercase());
                current_word = String::new();
            }
        } else if c.is_uppercase() && !current_word.is_empty() {
            // camelCase boundary
            words.push(current_word.to_lowercase());
            current_word = c.to_lowercase().to_string();
        } else if c.is_alphanumeric() {
            current_word.push(c);
        } else {
            // Preserve other characters as word boundaries
            if !current_word.is_empty() {
                words.push(current_word.to_lowercase());
                current_word = String::new();
            }
        }
    }

    if !current_word.is_empty() {
        words.push(current_word.to_lowercase());
    }

    words
}

fn to_camel_case(text: &str) -> String {
    let words = split_into_words(text);
    if words.is_empty() {
        return String::new();
    }

    let mut result = words[0].clone();
    for word in words.iter().skip(1) {
        if let Some(first) = word.chars().next() {
            result.push_str(&first.to_uppercase().to_string());
            result.push_str(&word[first.len_utf8()..]);
        }
    }
    result
}

fn to_snake_case(text: &str) -> String {
    split_into_words(text).join("_")
}

fn to_kebab_case(text: &str) -> String {
    split_into_words(text).join("-")
}

pub fn count_occurrences(text: &str, pattern: &str) -> usize {
    if pattern.is_empty() {
        return 0;
    }
    text.matches(pattern).count()
}

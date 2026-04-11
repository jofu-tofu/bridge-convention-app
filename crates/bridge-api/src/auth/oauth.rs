use serde::Deserialize;

use crate::config::Config;

#[derive(Debug, Clone, Copy)]
pub enum OAuthProvider {
    Google,
    GitHub,
}

impl OAuthProvider {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "google" => Some(Self::Google),
            "github" => Some(Self::GitHub),
            _ => None,
        }
    }
}

#[derive(Debug)]
pub struct OAuthProfile {
    pub provider_user_id: String,
    pub email: Option<String>,
    pub name: String,
    pub avatar_url: Option<String>,
}

/// Build the authorization URL for the OAuth consent screen.
pub fn authorization_url(provider: OAuthProvider, config: &Config, state: &str) -> String {
    let callback_url = format!(
        "{}/api/auth/callback/{}",
        config.base_url,
        provider_slug(provider)
    );

    match provider {
        OAuthProvider::Google => {
            format!(
                "https://accounts.google.com/o/oauth2/v2/auth?\
                 client_id={}&redirect_uri={}&response_type=code&scope=openid%20email%20profile&state={}&access_type=offline",
                urlencoding::encode(&config.google_client_id),
                urlencoding::encode(&callback_url),
                urlencoding::encode(state),
            )
        }
        OAuthProvider::GitHub => {
            format!(
                "https://github.com/login/oauth/authorize?\
                 client_id={}&redirect_uri={}&scope=read:user%20user:email&state={}",
                urlencoding::encode(&config.github_client_id),
                urlencoding::encode(&callback_url),
                urlencoding::encode(state),
            )
        }
    }
}

/// Exchange an authorization code for user profile information.
pub async fn exchange_code(
    provider: OAuthProvider,
    config: &Config,
    code: &str,
) -> Result<OAuthProfile, reqwest::Error> {
    let callback_url = format!(
        "{}/api/auth/callback/{}",
        config.base_url,
        provider_slug(provider)
    );
    let client = reqwest::Client::new();

    match provider {
        OAuthProvider::Google => exchange_google(&client, config, code, &callback_url).await,
        OAuthProvider::GitHub => exchange_github(&client, config, code, &callback_url).await,
    }
}

fn provider_slug(provider: OAuthProvider) -> &'static str {
    match provider {
        OAuthProvider::Google => "google",
        OAuthProvider::GitHub => "github",
    }
}

// ── Google ──────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct GoogleTokenResponse {
    access_token: String,
}

#[derive(Deserialize)]
struct GoogleUserInfo {
    sub: String,
    email: Option<String>,
    name: Option<String>,
    picture: Option<String>,
}

async fn exchange_google(
    client: &reqwest::Client,
    config: &Config,
    code: &str,
    redirect_uri: &str,
) -> Result<OAuthProfile, reqwest::Error> {
    let token_resp: GoogleTokenResponse = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("code", code),
            ("client_id", &config.google_client_id),
            ("client_secret", &config.google_client_secret),
            ("redirect_uri", redirect_uri),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await?
        .json()
        .await?;

    let user_info: GoogleUserInfo = client
        .get("https://www.googleapis.com/oauth2/v3/userinfo")
        .bearer_auth(&token_resp.access_token)
        .send()
        .await?
        .json()
        .await?;

    Ok(OAuthProfile {
        provider_user_id: user_info.sub,
        email: user_info.email,
        name: user_info.name.unwrap_or_else(|| "User".to_string()),
        avatar_url: user_info.picture,
    })
}

// ── GitHub ──────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct GitHubTokenResponse {
    access_token: String,
}

#[derive(Deserialize)]
struct GitHubUser {
    id: u64,
    login: String,
    name: Option<String>,
    avatar_url: Option<String>,
}

#[derive(Deserialize)]
struct GitHubEmail {
    email: String,
    primary: bool,
    verified: bool,
}

async fn exchange_github(
    client: &reqwest::Client,
    config: &Config,
    code: &str,
    redirect_uri: &str,
) -> Result<OAuthProfile, reqwest::Error> {
    let token_resp: GitHubTokenResponse = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .form(&[
            ("code", code),
            ("client_id", &config.github_client_id),
            ("client_secret", &config.github_client_secret),
            ("redirect_uri", redirect_uri),
        ])
        .send()
        .await?
        .json()
        .await?;

    let user: GitHubUser = client
        .get("https://api.github.com/user")
        .header("User-Agent", "bridge-app")
        .bearer_auth(&token_resp.access_token)
        .send()
        .await?
        .json()
        .await?;

    // Fetch primary verified email (GitHub may have private email)
    let emails: Vec<GitHubEmail> = client
        .get("https://api.github.com/user/emails")
        .header("User-Agent", "bridge-app")
        .bearer_auth(&token_resp.access_token)
        .send()
        .await?
        .json()
        .await?;

    let primary_email = emails
        .into_iter()
        .find(|e| e.primary && e.verified)
        .map(|e| e.email);

    Ok(OAuthProfile {
        provider_user_id: user.id.to_string(),
        email: primary_email,
        name: user.name.unwrap_or(user.login),
        avatar_url: user.avatar_url,
    })
}

use bridge_api::{app, config::Config, db, AppState};

#[tokio::main]
async fn main() {
    let _ = dotenvy::from_filename("../../.env").or_else(|_| dotenvy::dotenv());

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "bridge_api=info".into()),
        )
        .init();

    let config = Config::from_env();
    let pool = db::init_db(&config.database_url).await;
    let state = AppState::new(pool, config);
    let app = app(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001")
        .await
        .expect("failed to bind to port 3001");

    tracing::info!("bridge-api listening on :3001");
    axum::serve(listener, app).await.expect("server error");
}

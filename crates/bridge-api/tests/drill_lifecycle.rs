use axum::body::{to_bytes, Body};
use axum::http::{header, Method, Request, StatusCode};
use bridge_api::test_support::{session_cookie_header, TestHarness, UserSeed};
use chrono::Utc;
use serde_json::{json, Value};

const FREE_USER: &str = "free-user";
const PAID_USER: &str = "paid-user";

const FREE_MODULE: &str = "stayman-bundle";
const PAID_MODULE: &str = "bergen-bundle";

#[tokio::test]
async fn list_drills_requires_session() {
    let harness = TestHarness::new().await;
    let response = harness.send(get("/api/drills", None)).await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body = body_json(response).await;
    assert_eq!(body["error"], "unauthenticated");
}

#[tokio::test]
async fn create_drill_requires_session() {
    let harness = TestHarness::new().await;
    let response = harness
        .send(post_json("/api/drills", None, &drill_request("New", &[FREE_MODULE])))
        .await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn free_user_blocked_from_paid_module_on_create() {
    let harness = TestHarness::new().await;
    let session = harness
        .insert_user_and_session(UserSeed::new(FREE_USER))
        .await;

    let response = harness
        .send(post_json(
            "/api/drills",
            Some(&session),
            &drill_request("Bergen drill", &[PAID_MODULE]),
        ))
        .await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    let body = body_json(response).await;
    assert_eq!(body["error"], "convention_locked");
    let blocked = body["blocked_module_ids"].as_array().unwrap();
    assert_eq!(blocked, &vec![Value::String(PAID_MODULE.to_string())]);
}

#[tokio::test]
async fn free_user_can_create_free_module_drill_round_trip() {
    let harness = TestHarness::new().await;
    let session = harness
        .insert_user_and_session(UserSeed::new(FREE_USER))
        .await;

    let create = harness
        .send(post_json(
            "/api/drills",
            Some(&session),
            &drill_request("Stayman", &[FREE_MODULE]),
        ))
        .await;
    assert_eq!(create.status(), StatusCode::CREATED);
    let created = body_json(create).await;
    let drill_id = created["drill"]["id"].as_str().unwrap().to_string();
    assert!(drill_id.starts_with("drill:"));
    assert_eq!(created["drill"]["moduleIds"][0], FREE_MODULE);

    let listed = harness.send(get("/api/drills", Some(&session))).await;
    assert_eq!(listed.status(), StatusCode::OK);
    let listed_body = body_json(listed).await;
    let drills = listed_body["drills"].as_array().unwrap();
    assert_eq!(drills.len(), 1);
    assert_eq!(drills[0]["id"], drill_id);
}

#[tokio::test]
async fn cross_user_isolation() {
    let harness = TestHarness::new().await;
    let session_a = harness.insert_user_and_session(UserSeed::new("user-a")).await;
    let session_b = harness.insert_user_and_session(UserSeed::new("user-b")).await;

    let create = harness
        .send(post_json(
            "/api/drills",
            Some(&session_a),
            &drill_request("A's drill", &[FREE_MODULE]),
        ))
        .await;
    assert_eq!(create.status(), StatusCode::CREATED);
    let drill_id = body_json(create).await["drill"]["id"].as_str().unwrap().to_string();

    // user B does not see user A's drill
    let listed = harness.send(get("/api/drills", Some(&session_b))).await;
    let listed_body = body_json(listed).await;
    assert_eq!(listed_body["drills"].as_array().unwrap().len(), 0);

    // user B PUT on user A's drill ID returns 404
    let put = harness
        .send(put_json(
            &format!("/api/drills/{drill_id}"),
            Some(&session_b),
            &drill_request("hijacked", &[FREE_MODULE]),
        ))
        .await;
    assert_eq!(put.status(), StatusCode::NOT_FOUND);

    // user B DELETE on user A's drill ID returns 404
    let del = harness
        .send(delete_req(&format!("/api/drills/{drill_id}"), Some(&session_b)))
        .await;
    assert_eq!(del.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn rename_only_on_paid_drill_succeeds_for_free_user() {
    let harness = TestHarness::new().await;
    let paid_until = Utc::now().timestamp() + 86_400;
    let paid_session = harness
        .insert_user_and_session(UserSeed {
            id: PAID_USER,
            subscription_status: Some("active"),
            subscription_current_period_end: Some(paid_until),
            ..UserSeed::new(PAID_USER)
        })
        .await;

    let create = harness
        .send(post_json(
            "/api/drills",
            Some(&paid_session),
            &drill_request("Bergen", &[PAID_MODULE]),
        ))
        .await;
    let drill_id = body_json(create).await["drill"]["id"].as_str().unwrap().to_string();

    // Re-login same user as free (downgrade simulated by status=null)
    sqlx::query("UPDATE users SET subscription_status = NULL WHERE id = ?")
        .bind(PAID_USER)
        .execute(&harness.state.pool)
        .await
        .expect("downgrade");

    // Rename-only PUT succeeds (no new modules added)
    let put = harness
        .send(put_json(
            &format!("/api/drills/{drill_id}"),
            Some(&paid_session),
            &drill_request("Bergen renamed", &[PAID_MODULE]),
        ))
        .await;
    assert_eq!(put.status(), StatusCode::OK);
    let body = body_json(put).await;
    assert_eq!(body["drill"]["name"], "Bergen renamed");
}

#[tokio::test]
async fn add_paid_module_to_existing_drill_returns_403_for_free_user() {
    let harness = TestHarness::new().await;
    let session = harness
        .insert_user_and_session(UserSeed::new(FREE_USER))
        .await;

    let create = harness
        .send(post_json(
            "/api/drills",
            Some(&session),
            &drill_request("free", &[FREE_MODULE]),
        ))
        .await;
    let drill_id = body_json(create).await["drill"]["id"].as_str().unwrap().to_string();

    let put = harness
        .send(put_json(
            &format!("/api/drills/{drill_id}"),
            Some(&session),
            &drill_request("free + paid", &[FREE_MODULE, PAID_MODULE]),
        ))
        .await;
    assert_eq!(put.status(), StatusCode::FORBIDDEN);
    let body = body_json(put).await;
    assert_eq!(body["error"], "convention_locked");
    assert_eq!(
        body["blocked_module_ids"].as_array().unwrap(),
        &vec![Value::String(PAID_MODULE.to_string())]
    );
}

#[tokio::test]
async fn remove_paid_module_succeeds_for_free_user() {
    let harness = TestHarness::new().await;
    let paid_until = Utc::now().timestamp() + 86_400;
    let session = harness
        .insert_user_and_session(UserSeed {
            id: PAID_USER,
            subscription_status: Some("active"),
            subscription_current_period_end: Some(paid_until),
            ..UserSeed::new(PAID_USER)
        })
        .await;

    let create = harness
        .send(post_json(
            "/api/drills",
            Some(&session),
            &drill_request("mixed", &[FREE_MODULE, PAID_MODULE]),
        ))
        .await;
    let drill_id = body_json(create).await["drill"]["id"].as_str().unwrap().to_string();

    sqlx::query("UPDATE users SET subscription_status = NULL WHERE id = ?")
        .bind(PAID_USER)
        .execute(&harness.state.pool)
        .await
        .expect("downgrade");

    let put = harness
        .send(put_json(
            &format!("/api/drills/{drill_id}"),
            Some(&session),
            &drill_request("free only", &[FREE_MODULE]),
        ))
        .await;
    assert_eq!(put.status(), StatusCode::OK);
    let body = body_json(put).await;
    assert_eq!(
        body["drill"]["moduleIds"].as_array().unwrap(),
        &vec![Value::String(FREE_MODULE.to_string())]
    );
}

#[tokio::test]
async fn tuning_only_edit_on_paid_drill_succeeds_for_free_user() {
    let harness = TestHarness::new().await;
    let paid_until = Utc::now().timestamp() + 86_400;
    let session = harness
        .insert_user_and_session(UserSeed {
            id: PAID_USER,
            subscription_status: Some("active"),
            subscription_current_period_end: Some(paid_until),
            ..UserSeed::new(PAID_USER)
        })
        .await;

    let create = harness
        .send(post_json(
            "/api/drills",
            Some(&session),
            &drill_request("paid", &[PAID_MODULE]),
        ))
        .await;
    let drill_id = body_json(create).await["drill"]["id"].as_str().unwrap().to_string();

    sqlx::query("UPDATE users SET subscription_status = NULL WHERE id = ?")
        .bind(PAID_USER)
        .execute(&harness.state.pool)
        .await
        .expect("downgrade");

    let mut req = drill_request("paid", &[PAID_MODULE]);
    req["playProfileId"] = Value::String("expert".into());
    let put = harness
        .send(put_json(
            &format!("/api/drills/{drill_id}"),
            Some(&session),
            &req,
        ))
        .await;
    assert_eq!(put.status(), StatusCode::OK);
    let body = body_json(put).await;
    assert_eq!(body["drill"]["playProfileId"], "expert");
}

#[tokio::test]
async fn delete_is_idempotent_and_filters_out_of_list() {
    let harness = TestHarness::new().await;
    let session = harness
        .insert_user_and_session(UserSeed::new(FREE_USER))
        .await;

    let create = harness
        .send(post_json(
            "/api/drills",
            Some(&session),
            &drill_request("to-delete", &[FREE_MODULE]),
        ))
        .await;
    let drill_id = body_json(create).await["drill"]["id"].as_str().unwrap().to_string();

    let first = harness
        .send(delete_req(&format!("/api/drills/{drill_id}"), Some(&session)))
        .await;
    assert_eq!(first.status(), StatusCode::NO_CONTENT);

    let second = harness
        .send(delete_req(&format!("/api/drills/{drill_id}"), Some(&session)))
        .await;
    assert_eq!(second.status(), StatusCode::NO_CONTENT);

    // verify deleted_at is set
    let deleted_at: Option<String> =
        sqlx::query_scalar("SELECT deleted_at FROM user_drills WHERE id = ?")
            .bind(&drill_id)
            .fetch_one(&harness.state.pool)
            .await
            .expect("row");
    assert!(deleted_at.is_some());

    let listed = harness.send(get("/api/drills", Some(&session))).await;
    let body = body_json(listed).await;
    assert_eq!(body["drills"].as_array().unwrap().len(), 0);

    // PUT on deleted drill returns 404
    let put = harness
        .send(put_json(
            &format!("/api/drills/{drill_id}"),
            Some(&session),
            &drill_request("rev", &[FREE_MODULE]),
        ))
        .await;
    assert_eq!(put.status(), StatusCode::NOT_FOUND);

    // DELETE for never-existed drill returns 404
    let never = harness
        .send(delete_req("/api/drills/drill:doesnotexist", Some(&session)))
        .await;
    assert_eq!(never.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn launched_on_paid_drill_blocked_for_free_user() {
    let harness = TestHarness::new().await;
    let paid_until = Utc::now().timestamp() + 86_400;
    let session = harness
        .insert_user_and_session(UserSeed {
            id: PAID_USER,
            subscription_status: Some("active"),
            subscription_current_period_end: Some(paid_until),
            ..UserSeed::new(PAID_USER)
        })
        .await;

    let create = harness
        .send(post_json(
            "/api/drills",
            Some(&session),
            &drill_request("paid", &[PAID_MODULE]),
        ))
        .await;
    let drill_id = body_json(create).await["drill"]["id"].as_str().unwrap().to_string();

    sqlx::query("UPDATE users SET subscription_status = NULL WHERE id = ?")
        .bind(PAID_USER)
        .execute(&harness.state.pool)
        .await
        .expect("downgrade");

    let response = harness
        .send(post_empty(
            &format!("/api/drills/{drill_id}/launched"),
            Some(&session),
        ))
        .await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    let body = body_json(response).await;
    assert_eq!(body["error"], "convention_locked");
}

#[tokio::test]
async fn unknown_module_id_returns_400() {
    let harness = TestHarness::new().await;
    let session = harness
        .insert_user_and_session(UserSeed::new(FREE_USER))
        .await;

    let response = harness
        .send(post_json(
            "/api/drills",
            Some(&session),
            &drill_request("legacy", &["nt-stayman"]),
        ))
        .await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let body = body_json(response).await;
    assert_eq!(body["error"], "unknown_module");
    assert_eq!(
        body["module_ids"].as_array().unwrap(),
        &vec![Value::String("nt-stayman".to_string())]
    );
}

// ─── Helpers ──────────────────────────────────────────

fn drill_request(name: &str, module_ids: &[&str]) -> Value {
    json!({
        "name": name,
        "moduleIds": module_ids,
        "practiceMode": "decision-drill",
        "practiceRole": "auto",
        "systemSelectionId": "sayc",
        "opponentMode": "natural",
        "playProfileId": "club-player",
        "vulnerabilityDistribution": {"none": 1.0, "ours": 0.0, "theirs": 0.0, "both": 0.0},
        "showEducationalAnnotations": true,
    })
}

fn get(uri: &str, session: Option<&str>) -> Request<Body> {
    let mut builder = Request::builder().method(Method::GET).uri(uri);
    if let Some(token) = session {
        builder = builder.header(header::COOKIE, session_cookie_header(token));
    }
    builder.body(Body::empty()).expect("request")
}

fn post_json(uri: &str, session: Option<&str>, body: &Value) -> Request<Body> {
    let mut builder = Request::builder()
        .method(Method::POST)
        .uri(uri)
        .header(header::CONTENT_TYPE, "application/json");
    if let Some(token) = session {
        builder = builder.header(header::COOKIE, session_cookie_header(token));
    }
    builder
        .body(Body::from(body.to_string()))
        .expect("request")
}

fn put_json(uri: &str, session: Option<&str>, body: &Value) -> Request<Body> {
    let mut builder = Request::builder()
        .method(Method::PUT)
        .uri(uri)
        .header(header::CONTENT_TYPE, "application/json");
    if let Some(token) = session {
        builder = builder.header(header::COOKIE, session_cookie_header(token));
    }
    builder
        .body(Body::from(body.to_string()))
        .expect("request")
}

fn delete_req(uri: &str, session: Option<&str>) -> Request<Body> {
    let mut builder = Request::builder().method(Method::DELETE).uri(uri);
    if let Some(token) = session {
        builder = builder.header(header::COOKIE, session_cookie_header(token));
    }
    builder.body(Body::empty()).expect("request")
}

fn post_empty(uri: &str, session: Option<&str>) -> Request<Body> {
    let mut builder = Request::builder().method(Method::POST).uri(uri);
    if let Some(token) = session {
        builder = builder.header(header::COOKIE, session_cookie_header(token));
    }
    builder.body(Body::empty()).expect("request")
}

async fn body_json(response: axum::response::Response) -> Value {
    let bytes = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body");
    if bytes.is_empty() {
        return Value::Null;
    }
    serde_json::from_slice(&bytes).expect("json body")
}

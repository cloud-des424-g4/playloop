*** Settings ***
Documentation     Browser tests of PlayLoop business endpoints through Swagger UI; no product frontend exists in this checkout.
Library           SeleniumLibrary    timeout=20s
Library           Collections
Test Setup        Open API Documentation
Test Teardown     Close All Browsers

*** Variables ***
${BASE_URL}       http://localhost:4000
${BROWSER}        edge
${FIXTURE_MODE}   disabled
${OPTIONS}        add_argument("--headless=new");add_argument("--window-size=1440,1000")

*** Test Cases ***
UI-001 API Documentation Loads
    [Documentation]    The real documentation page renders the PlayLoop title and health operation.
    Element Should Contain    css:.info .title    PlayLoop API
    Page Should Contain Element    id:operations-Health-getHealth
    Capture Page Screenshot    UI-001-docs.png

UI-002 Login Documentation Expands And Collapses
    [Documentation]    Tests documentation navigation only, not successful login.
    Click Element    css:#operations-Auth-login .opblock-summary-control
    Wait Until Element Is Visible    css:#operations-Auth-login .opblock-body
    Element Should Contain    id:operations-Auth-login    Request body
    Scroll Element Into View    css:#operations-Auth-login .opblock-body
    Capture Page Screenshot    UI-002-login-expanded.png
    Click Element    css:#operations-Auth-login .opblock-summary-control
    Wait Until Element Is Not Visible    css:#operations-Auth-login .opblock-body
    Capture Page Screenshot    UI-002-login-collapsed.png

UI-003 Health Request Returns Connected Database
    Execute Operation    operations-Health-getHealth
    Wait Until Element Contains    css:#operations-Health-getHealth .live-responses-table tbody .response-col_status    200
    Element Should Contain    css:#operations-Health-getHealth .live-responses-table    "status": "ok"
    Element Should Contain    css:#operations-Health-getHealth .live-responses-table    "db": "connected"
    Scroll Element Into View    css:#operations-Health-getHealth .live-responses-table
    Capture Page Screenshot    UI-003-health.png

UI-004 Anonymous Profile Request Is Rejected
    Execute Operation    operations-Me-getMe
    Wait Until Element Contains    css:#operations-Me-getMe .live-responses-table tbody .response-col_status    401
    Element Should Contain    css:#operations-Me-getMe .live-responses-table    UNAUTHORIZED
    Element Should Contain    css:#operations-Me-getMe .live-responses-table    Please log in to continue
    Scroll Element Into View    css:#operations-Me-getMe .live-responses-table
    Capture Page Screenshot    UI-004-unauthorized.png

UI-005 Register Temporary Account And Read Session Profile
    [Setup]    Open Isolated Documentation
    ${suffix}=    Evaluate    uuid.uuid4().hex[:10]    modules=uuid
    ${username}=    Set Variable    robot${suffix}
    Prepare Operation    operations-Auth-register
    Input Text    css:#operations-Auth-register textarea.body-param__text    {"username":"${username}","email":"${username}@example.com","password":"Robot-Registration-42","acceptTerms":true}
    Submit Operation    operations-Auth-register
    ${body}=    Read JSON Response    operations-Auth-register    201
    Should Be Equal    ${body}[username]    ${username}
    Dictionary Should Not Contain Key    ${body}    passwordHash
    Save Response Screenshot    operations-Auth-register    UI-005-registration.png
    Execute Operation    operations-Me-getMe
    ${profile}=    Read JSON Response    operations-Me-getMe    200
    Should Be Equal    ${profile}[email]    ${username}@example.com

UI-006 Duplicate Registration Is Rejected
    [Setup]    Open Isolated Documentation
    Prepare Operation    operations-Auth-register
    Input Text    css:#operations-Auth-register textarea.body-param__text    {"username":"robotfixture","email":"robotfixture@example.com","password":"Robot-Fixture-Only-42","acceptTerms":true}
    Submit Operation    operations-Auth-register
    ${body}=    Read JSON Response    operations-Auth-register    409
    Should Be Equal    ${body}[code]    CONFLICT
    Should Be Equal    ${body}[message]    username is already taken
    Save Response Screenshot    operations-Auth-register    UI-006-duplicate.png

UI-007 Valid Login Creates Session
    [Setup]    Open Isolated Documentation
    Prepare Operation    operations-Auth-login
    Input Text    css:#operations-Auth-login textarea.body-param__text    {"email":"robotfixture@example.com","password":"Robot-Fixture-Only-42"}
    Submit Operation    operations-Auth-login
    ${body}=    Read JSON Response    operations-Auth-login    200
    Should Be Equal    ${body}[username]    robotfixture
    Dictionary Should Not Contain Key    ${body}    passwordHash
    Save Response Screenshot    operations-Auth-login    UI-007-login.png
    Execute Operation    operations-Me-getMe
    ${profile}=    Read JSON Response    operations-Me-getMe    200
    Should Be Equal    ${profile}[email]    robotfixture@example.com

UI-008 Invalid Password Does Not Create Session
    [Setup]    Open Isolated Documentation
    Prepare Operation    operations-Auth-login
    Input Text    css:#operations-Auth-login textarea.body-param__text    {"email":"robotfixture@example.com","password":"Deliberately-Wrong-42"}
    Submit Operation    operations-Auth-login
    ${body}=    Read JSON Response    operations-Auth-login    401
    Should Be Equal    ${body}[code]    UNAUTHORIZED
    Should Be Equal    ${body}[message]    Email or password is incorrect
    Save Response Screenshot    operations-Auth-login    UI-008-invalid-login.png
    Execute Operation    operations-Me-getMe
    Read JSON Response    operations-Me-getMe    401

UI-009 Game Listing Includes Published Games And Hides Draft
    [Setup]    Open Isolated Documentation
    Execute Operation    operations-Games-listGames
    ${body}=    Read JSON Response    operations-Games-listGames    200
    Should Be Equal As Integers    ${body}[total]    2
    ${titles}=    Evaluate    [item['title'] for item in $body['items']]
    List Should Contain Value    ${titles}    Robot Tempest
    List Should Contain Value    ${titles}    Robot Undertow
    List Should Not Contain Value    ${titles}    Robot Secret Draft
    Save Response Screenshot    operations-Games-listGames    UI-009-game-listing.png

UI-010 Game Search Returns Only Matching Published Game
    [Setup]    Open Isolated Documentation
    Prepare Operation    operations-Games-listGames
    Input Text    css:#operations-Games-listGames input[placeholder="search"]    tempest
    Submit Operation    operations-Games-listGames
    ${body}=    Read JSON Response    operations-Games-listGames    200
    Should Be Equal As Integers    ${body}[total]    1
    Length Should Be    ${body}[items]    1
    Should Be Equal    ${body}[items][0][title]    Robot Tempest
    Save Response Screenshot    operations-Games-listGames    UI-010-search.png

*** Keywords ***
Open API Documentation
    Open Browser    ${BASE_URL}/api/docs/    ${BROWSER}    options=${OPTIONS}
    Wait Until Element Is Visible    css:.info .title
    Wait Until Element Is Visible    id:operations-Health-getHealth

Execute Operation
    [Arguments]    ${operation}
    Prepare Operation    ${operation}
    Submit Operation    ${operation}

Prepare Operation
    [Arguments]    ${operation}
    Click Element    css:#${operation} .opblock-summary-control
    Wait Until Element Is Visible    css:#${operation} .try-out__btn
    Click Element    css:#${operation} .try-out__btn
    Wait Until Element Is Visible    css:#${operation} button.execute

Submit Operation
    [Arguments]    ${operation}
    Click Element    css:#${operation} button.execute
    Wait Until Element Is Visible    css:#${operation} .live-responses-table

Open Isolated Documentation
    Should Be Equal    ${FIXTURE_MODE}    isolated    These tests require the dedicated start-test-server.mjs fixture, never a real database.
    Open API Documentation

Read JSON Response
    [Arguments]    ${operation}    ${status}
    Wait Until Element Contains    css:#${operation} .live-responses-table tbody .response-col_status    ${status}
    ${text}=    Get Text    css:#${operation} .live-responses-table .response-col_description pre
    ${body}=    Evaluate    json.loads($text)    modules=json
    RETURN    ${body}

Save Response Screenshot
    [Arguments]    ${operation}    ${filename}
    Scroll Element Into View    css:#${operation} .live-responses-table
    Capture Page Screenshot    ${filename}

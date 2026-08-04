# End-to-End QA Workflow with Natural Language

## Workflow Overview

This prompt set guides you through a complete 7-step QA workflow using MCP servers and AI agents — from reading a user story to committing automated test scripts.

---

## STEP 1: Read User Story

**Prompt:**
```
I need to start a new testing workflow. Please read the user story from the file:
user-stories/SCRUM.md

Summarize the key requirements, acceptance criteria, and testing scope.
```

**Expected Output:**
- Summary of the user story
- List of acceptance criteria
- Application URL and test credentials
- Key features to test

---

## STEP 2: Create Test Plan

**Prompt:**
```
Based on the user story SCRUM that we just reviewed, use the playwright-test-planner agent to:

1. Read the application URL and test credentials from the user story
2. Explore the application and understand all workflows mentioned in the acceptance criteria
3. Create a comprehensive test plan that covers all acceptance criteria, including:
   - Happy path scenarios
   - Negative scenarios (validation errors, empty fields, invalid data)
   - Navigation flow tests
   - UI element validation
4. Save the test plan as: specs/planner/README.md (split into one file per feature domain under specs/planner/)

Ensure each test scenario includes:
- Clear test case title
- Detailed step-by-step instructions
- Expected result for each step
- Test data requirements
```

**Expected Output:**
- Complete test plan markdown file saved to specs/
- Test scenarios organized with a clear structure
- Browser exploration screenshots (if needed)

---

## STEP 3: Perform Exploratory Testing

**Prompt:**
```
Now I need to perform manual exploratory testing using Playwright MCP browser tools.
Please read the test plan from: specs/SCRUM.md

Then execute the test scenarios defined in that plan:

1. Use the Playwright browser tools to manually execute each test case scenario from the plan
2. Follow the step-by-step instructions in each test case
3. Verify expected results match the actual results
4. Take screenshots at key steps and error states
5. Document your findings:
   - Test execution results for each scenario
   - Any UI inconsistencies or unexpected behaviors
   - Missing validation or bugs discovered
   - Screenshots as evidence
```

**Expected Output:**
- Manual test execution results
- Screenshots of the application at various states
- List of observations and findings
- Any issues discovered during exploration

---

## STEP 4: Generate Automation Scripts

**Prompt:**
```
Now I need to create automated test scripts using the playwright-test-generator agent.

Please review:
1. Test plan from: specs/SCRUM.md (for test scenarios and steps)
2. Exploratory testing results from Step 3 (for actual element selectors and UI insights)

Using insights from the manual exploratory testing:
- Leverage the element selectors and locators that were successfully used in Step 3
- Use stable element properties (IDs, data attributes, roles) discovered during exploration
- Apply wait strategies and UI behaviors observed during manual testing
- Incorporate any workarounds for UI quirks discovered

Generate Playwright JavaScript automation scripts:
1. Create scripts for each test scenario from the test plan
2. Organize scripts into appropriate test suite files in: tests/rural_lodge_test/
3. Use the test case names and steps from the test plan
4. Use reliable selectors and strategies from exploratory testing

Requirements for all scripts:
- Follow Playwright best practices
- Include proper assertions using expect()
- Use descriptive test names matching the format in the test plan
- Use robust element selectors discovered during manual testing
- Add comments for complex steps
- Use proper wait strategies based on actual application behavior
- Add proper test hooks (beforeEach, afterEach)
- Configure for multiple browsers (Chrome, Firefox, Safari)

After generating the scripts, run the tests to verify they pass.
```

**Expected Output:**
- Test suite files created in tests/rural_lodge-test/ based on test plan scenarios
- Scripts using robust selectors discovered during exploratory testing
- All scripts follow Playwright best practices
- Initial test generation complete

---

## STEP 5: Execute and Heal Automation Tests

**Prompt:**
```
Now I need to execute the generated automation scripts and heal any failures using the playwright-test-healer agent.

1. Run all automation scripts in: tests/rural_lodge-test/
2. Identify any failing tests
3. For each failing test, use the playwright-test-healer agent to:
   - Analyze the failure (selector issues, timing issues, assertion failures)
   - Auto-heal the test by fixing selectors, adding waits, or adjusting assertions
   - Update the test script with the fixes
4. Re-run the healed tests to verify they pass
5. Repeat the heal process until all tests are stable and passing
6. Document:
   - Initial test results (pass/fail count)
   - Healing activities performed
   - Final test results after healing
   - Any tests that couldn't be auto-healed
```

**Expected Output:**
- All automation tests executed
- Failing tests identified and healed using the test-healer agent
- Healed test scripts updated in tests/rural_lodge-test/
- Final stable test execution results
- Summary of healing activities performed

---

## STEP 6: Create Test Report

**Prompt:**
```
Now I need to create a comprehensive test execution report based on manual testing, automation execution, and healing activities.

Please compile results from:
- Step 3: Manual exploratory testing results
- Step 4: Generated automation scripts
- Step 5: Automated test execution and healing results

Structure the report as: test-results/Report.md

Include:

1. Executive Summary
   - Total test cases planned
   - Test cases executed (manual + automated)
   - Overall Pass/Fail/Blocked status

2. Manual Test Results
   - Results from Step 3 exploratory testing
   - Screenshots and observations
   - Issues found during manual testing

3. Automated Test Results
   - Initial automation results from Step 5
   - Healing activities performed
   - Final test execution results after healing
   - Test suite execution summary
   - Pass/Fail count for each test suite

4. Defects Log
   - For any failed tests (manual or automated):
     - Bug ID
     - Severity (Critical/High/Medium/Low)
     - Title and description
     - Steps to reproduce
     - Expected vs. actual behavior
     - Screenshots/evidence
     - Environment details

5. Test Coverage Analysis
   - Which acceptance criteria are covered
   - Coverage from manual vs. automated tests
   - Any gaps in test coverage
   - Recommendations for additional testing

6. Summary and Recommendations
   - Overall quality assessment
   - Risk areas
   - Next steps
```

**Expected Output:**
- Comprehensive test execution report covering both manual and automated testing
- Clear PASS/FAIL status for all test scenarios
- Detailed bug reports for failures
- Complete test coverage analysis
- Evidence and screenshots attached

---

## STEP 7: Commit to Git Repository

**Git Repository URL:** `https://github.com/borinsatyakhuoy-prog/Rural_testing`

**Prompt:**
```
Now I need to commit all the test artifacts to the Git repository using the GitHub MCP server.

Git Repository URL: https://github.com/borinsatyakhuoy-prog/Rural_testing

Please perform the following Git operations:

1. Initialize Git repository if not already initialized

2. Stage all files in the workspace (all new and modified files)

3. Create a commit with the message:
   "feat(tests): Add complete test suite for SCRUM-101 checkout workflow

   - Add user story documentation
   - Add comprehensive test plan with all scenarios
   - Add test execution report with results
   - Add automated test scripts for checkout process
   - Include validation, navigation, and edge case tests

   Resolves SCRUM-101"

4. Push all changes to the Git repository

5. Provide a summary of what was committed
```

**Expected Output:**
- All workspace files committed to Git
- Descriptive commit message following conventional commit format
- Confirmation of successful push to the provided repository
- Summary of changes

---

## STEP 8: Smart Re-run (Incremental Update)

Use this after a first full run has already completed at least once, instead of repeating Steps 1–7 from scratch every time.

**Prompt:**
```
Now I want to re-run the QA workflow, but only redo what's necessary based on what changed
since the last run. Please:

1. Compare the current user story (user-stories/SCRUM.md) and test plan (specs/planner/README.md and its per-section files)
   against what the existing automation scripts (tests/rural_lodge-test/) and last test report
   (test-results/Report.md) were built from.

2. Decide the re-run scope:

   - FULL RE-RUN (redo Steps 2–7) if the user story or test plan itself changed
     (new/changed acceptance criteria, new scenarios, changed test data or credentials):
       - Step 2: Update/regenerate the test plan
       - Step 3: Re-run exploratory testing for the affected/new scenarios
       - Step 4: Regenerate or update automation scripts
       - Step 5: Execute and heal
       - Step 6: Update the test report
       - Step 7: Commit and push

   - PARTIAL RE-RUN (Steps 4–7 only) if the test plan is unchanged and only the
     application itself, its selectors, or the existing scripts need adjustment:
       - Step 4: Update only the affected automation scripts (do not re-plan or
         re-explore from scratch)
       - Step 5: Execute and heal the updated/failing scripts using the
         playwright-test-healer agent
       - Step 6: Update the test report with the new results
       - Step 7: Commit and push only the changed files

3. Before doing any work, state clearly which mode you chose (FULL or PARTIAL) and why,
   listing the specific files that triggered that decision.

4. Proceed with only the steps required for the chosen mode.
```

**Expected Output:**
- A clear FULL vs. PARTIAL decision with justification (which files changed)
- Only the necessary steps executed — no redundant re-planning or re-exploration when the test plan hasn't changed
- Updated automation scripts, test report, and Git commit reflecting just the incremental change

---

## 🎬 Complete Workflow Execution

**Single Combined Prompt (for Video Demo):**
```
I want to demonstrate a complete end-to-end QA workflow using natural language and MCP servers.

STEP 1 - READ USER STORY:
First, read the user story from: user-stories/SCRUM.md
Provide a brief summary of what needs to be tested.

STEP 2 - CREATE TEST PLAN:
Use the playwright-test-planner agent to create a comprehensive test plan based on the user story. The agent should explore the application URL from the user story and cover all acceptance criteria. Save it as: specs/rural_lodge-test-plan.md

STEP 3 - EXPLORATORY TESTING:
Read the test plan from specs/rural_lodge-test-plan.md and use Playwright browser tools to manually execute each test scenario. Document findings with screenshots and note any issues discovered.

STEP 4 - GENERATE AUTOMATION SCRIPTS:
Review both the test plan (specs/rural_lodge-test-plan.md) and exploratory testing results from Step 3. Use the playwright-test-generator agent to create JavaScript automation scripts leveraging the element selectors and insights discovered during manual testing. Save scripts in tests/rural_lodge-test/.

STEP 5 - EXECUTE AND HEAL TESTS:
Run all automation scripts from tests/rural_lodge-test/. Use the playwright-test-healer agent to identify and auto-heal any failing tests. Re-run tests until all are stable and passing. Document healing activities.

STEP 6 - CREATE TEST REPORT:
Create a comprehensive test execution report at: test-results/rural_lodge-test-report.md
Compile results from Step 3 (manual testing), Step 4 (script generation), and Step 5 (execution and healing). Include PASS/FAIL status, healing summary, defects log, and test coverage analysis.

STEP 7 - COMMIT TO GIT:
Use the GitHub MCP agent to commit all new files with a descriptive message and push to the repository.

Execute this complete workflow and provide status updates after each step.
And after finish workflow help show the result either using playwright or allure playwright
```
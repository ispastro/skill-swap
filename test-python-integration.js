// Professional Integration Test - Python Service
// Run: node test-python-integration.js

const API_URL = 'http://localhost:8000';
const PYTHON_URL = 'https://skillswap-matching-service.onrender.com';

async function testPythonService() {
  console.log('🧪 Professional Integration Test - Python Matching Service\n');
  console.log('=' .repeat(60));

  // Test 1: Python Service Health
  console.log('\n1️⃣ Testing Python Service Health...');
  try {
    const response = await fetch(`${PYTHON_URL}/health`);
    const data = await response.json();
    console.log('✅ Python service is healthy');
    console.log('   Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('❌ Python service health check failed:', error.message);
    return;
  }

  // Test 2: Register Test Users
  console.log('\n2️⃣ Registering test users...');
  
  const user1Email = `test-user1-${Date.now()}@test.com`;
  const user2Email = `test-user2-${Date.now()}@test.com`;
  
  let user1Token, user2Token;

  try {
    // Register User 1
    const reg1 = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'JavaScript Developer',
        email: user1Email,
        password: 'Test123!@#'
      })
    });
    const user1Data = await reg1.json();
    user1Token = user1Data.token;
    console.log('✅ User 1 registered');

    // Register User 2
    const reg2 = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Python Developer',
        email: user2Email,
        password: 'Test123!@#'
      })
    });
    const user2Data = await reg2.json();
    user2Token = user2Data.token;
    console.log('✅ User 2 registered');
  } catch (error) {
    console.log('❌ User registration failed:', error.message);
    return;
  }

  // Test 3: Update Profiles with Matching Skills
  console.log('\n3️⃣ Updating user profiles with complementary skills...');
  
  try {
    // User 1: Has JavaScript, Wants Python
    await fetch(`${API_URL}/api/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user1Token}`
      },
      body: JSON.stringify({
        bio: 'Full-stack developer with 5 years experience in JavaScript',
        skillsHave: ['JavaScript', 'React', 'Node.js', 'TypeScript'],
        skillsWant: ['Python', 'Django', 'Machine Learning']
      })
    });
    console.log('✅ User 1 profile updated (Has: JS, Wants: Python)');

    // User 2: Has Python, Wants JavaScript
    await fetch(`${API_URL}/api/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user2Token}`
      },
      body: JSON.stringify({
        bio: 'Python backend developer with 3 years experience',
        skillsHave: ['Python', 'Django', 'PostgreSQL', 'FastAPI'],
        skillsWant: ['JavaScript', 'React', 'TypeScript']
      })
    });
    console.log('✅ User 2 profile updated (Has: Python, Wants: JS)');
  } catch (error) {
    console.log('❌ Profile update failed:', error.message);
    return;
  }

  // Test 4: Test Matching via Python Service
  console.log('\n4️⃣ Testing matching algorithm (via Python service)...');
  console.log('   ⏳ This may take 30-60 seconds on Render free tier (cold start)...');
  
  try {
    const startTime = Date.now();
    const matchResponse = await fetch(`${API_URL}/api/match/matches`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${user1Token}`
      }
    });
    const matchData = await matchResponse.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Matching completed in ${duration}s`);
    console.log('   Source:', matchData.source);
    console.log('   Total matches:', matchData.totalMatches);
    console.log('   Message:', matchData.message);
    
    if (matchData.matches && matchData.matches.length > 0) {
      console.log('\n   📊 Match Details:');
      matchData.matches.forEach((match, i) => {
        console.log(`   ${i + 1}. ${match.name}`);
        console.log(`      Score: ${match.matchScore}%`);
        console.log(`      Skills they have: ${match.skillsHave.join(', ')}`);
        console.log(`      Skills they want: ${match.skillsWant.join(', ')}`);
      });
    }

    // Verify it's using Python service
    if (matchData.source === 'python-service') {
      console.log('\n✅ INTEGRATION SUCCESS: Python service is working!');
    } else {
      console.log('\n⚠️  WARNING: Not using Python service (source:', matchData.source + ')');
    }

  } catch (error) {
    console.log('❌ Matching failed:', error.message);
    return;
  }

  // Test 5: Performance Metrics
  console.log('\n5️⃣ Performance Metrics:');
  console.log('   - Python service: Deployed on Render');
  console.log('   - Node.js API: Running locally');
  console.log('   - Database: Supabase PostgreSQL');
  console.log('   - Cache: Upstash Redis');

  console.log('\n' + '='.repeat(60));
  console.log('🎉 Integration Test Complete!\n');
  console.log('Next Steps:');
  console.log('1. Deploy Node.js API to Render');
  console.log('2. Update PYTHON_MATCH_SERVICE_URL in Render env vars');
  console.log('3. Test end-to-end in production');
}

// Run the test
testPythonService().catch(console.error);

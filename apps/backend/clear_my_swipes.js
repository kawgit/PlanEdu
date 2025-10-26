#!/usr/bin/env node
/**
 * Clear Swipe Data Script
 * 
 * This script clears all swipe interactions (bookmarks) for a user.
 * Run with: node clear_my_swipes.js YOUR_GOOGLE_ID
 * 
 * Options:
 *   --reset-embedding    Also reset the user embedding to start fresh
 *   --dry-run           Show what would be deleted without actually deleting
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function clearSwipeData(googleId, options = {}) {
  const { resetEmbedding = false, dryRun = false } = options;
  
  console.log(`\n🧹 Clearing swipe data for user: ${googleId}`);
  console.log(`Options: resetEmbedding=${resetEmbedding}, dryRun=${dryRun}\n`);
  
  try {
    // 1. Get user ID
    const users = await sql`
      SELECT id, name, email, major 
      FROM "Users" 
      WHERE google_id = ${googleId}
    `;
    
    if (users.length === 0) {
      console.error('❌ User not found with Google ID:', googleId);
      process.exit(1);
    }
    
    const user = users[0];
    console.log('👤 Found user:');
    console.log(`   Name: ${user.name || 'N/A'}`);
    console.log(`   Email: ${user.email || 'N/A'}`);
    console.log(`   Major: ${user.major || 'N/A'}`);
    console.log(`   User ID: ${user.id}\n`);
    
    // 2. Count existing bookmarks
    const bookmarkCount = await sql`
      SELECT COUNT(*) as count
      FROM "Bookmark"
      WHERE "userId" = ${user.id}
    `;
    
    const count = parseInt(bookmarkCount[0].count);
    console.log(`📚 Current bookmarks: ${count}`);
    
    if (count === 0) {
      console.log('✅ No bookmarks to clear!\n');
      return;
    }
    
    // 3. Show what will be deleted
    const bookmarks = await sql`
      SELECT 
        c.school,
        c.department,
        c.number,
        c.title,
        b.created_at
      FROM "Bookmark" b
      JOIN "Class" c ON c.id = b."classId"
      WHERE b."userId" = ${user.id}
      ORDER BY b.created_at DESC
      LIMIT 10
    `;
    
    console.log(`\n📋 Bookmarked courses (showing first 10):`);
    bookmarks.forEach((b, i) => {
      const code = `${b.school}${b.department} ${b.number}`;
      const date = new Date(b.created_at).toLocaleDateString();
      console.log(`   ${i + 1}. ${code}: ${b.title} (${date})`);
    });
    
    if (count > 10) {
      console.log(`   ... and ${count - 10} more`);
    }
    
    if (dryRun) {
      console.log('\n🔍 DRY RUN - No changes made');
      console.log(`Would delete ${count} bookmark(s)`);
      if (resetEmbedding) {
        console.log('Would reset user embedding');
      }
      return;
    }
    
    // 4. Confirm deletion
    if (process.argv.includes('--yes') || process.argv.includes('-y')) {
      // Auto-confirm
    } else {
      console.log('\n⚠️  This will permanently delete all your swipe data!');
      console.log('Press Ctrl+C to cancel, or add --yes flag to skip this prompt.\n');
      // In a real implementation, you'd use readline to get user confirmation
      // For now, require --yes flag
      if (!process.argv.includes('--yes')) {
        console.log('❌ Aborted. Run with --yes flag to confirm deletion.');
        process.exit(0);
      }
    }
    
    // 5. Delete bookmarks
    console.log('\n🗑️  Deleting bookmarks...');
    await sql`
      DELETE FROM "Bookmark"
      WHERE "userId" = ${user.id}
    `;
    console.log(`✅ Deleted ${count} bookmark(s)`);
    
    // 6. Reset embedding if requested
    if (resetEmbedding) {
      console.log('\n🔄 Resetting user embedding...');
      await sql`
        UPDATE "Users"
        SET 
          embedding = NULL,
          embedding_updated_at = NULL
        WHERE id = ${user.id}
      `;
      console.log('✅ User embedding reset');
      console.log('💡 You can recompute it using: POST /api/user/compute-embedding');
    }
    
    // 7. Verify
    const verifyCount = await sql`
      SELECT COUNT(*) as count
      FROM "Bookmark"
      WHERE "userId" = ${user.id}
    `;
    
    const remaining = parseInt(verifyCount[0].count);
    console.log(`\n✅ Cleanup complete! Remaining bookmarks: ${remaining}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
📖 Clear Swipe Data Script

Usage:
  node clear_my_swipes.js YOUR_GOOGLE_ID [options]

Options:
  --reset-embedding    Also reset user embedding (recommended)
  --dry-run           Preview what would be deleted
  --yes, -y           Skip confirmation prompt
  --help, -h          Show this help

Examples:
  # Preview deletion (safe)
  node clear_my_swipes.js YOUR_GOOGLE_ID --dry-run
  
  # Clear swipes only
  node clear_my_swipes.js YOUR_GOOGLE_ID --yes
  
  # Clear swipes AND reset embedding (recommended)
  node clear_my_swipes.js YOUR_GOOGLE_ID --reset-embedding --yes
  `);
  process.exit(0);
}

const googleId = args.find(arg => !arg.startsWith('--') && !arg.startsWith('-'));
const options = {
  resetEmbedding: args.includes('--reset-embedding'),
  dryRun: args.includes('--dry-run')
};

if (!googleId) {
  console.error('❌ Error: Google ID is required');
  console.log('Usage: node clear_my_swipes.js YOUR_GOOGLE_ID [options]');
  process.exit(1);
}

clearSwipeData(googleId, options);


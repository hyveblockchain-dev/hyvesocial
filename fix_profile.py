code = open('/root/server.js').read()

old = """    userRow.follower_count = parseInt(followerCount.rows[0].count);
    userRow.following_count = parseInt(followingCount.rows[0].count);

    res.json({ user: transformUser(userRow) });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});"""

new = """    userRow.follower_count = parseInt(followerCount.rows[0].count);
    userRow.following_count = parseInt(followingCount.rows[0].count);

    res.json({ user: transformUser(userRow, isAdmin) });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});"""

if old in code:
    code = code.replace(old, new, 1)
    open('/root/server.js', 'w').write(code)
    print('Updated profile endpoint to include walletAddress for admins')
else:
    print('Pattern not found')

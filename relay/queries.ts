export const UPSERT = `INSERT INTO reports(publisher,tweet_id,bucket,revision,issued_at,expires_at,payload)
          VALUES(?,?,?,?,?,?,?) ON CONFLICT(publisher,tweet_id) DO UPDATE SET
          seq=(SELECT COALESCE(MAX(seq),0)+1 FROM reports), revision=excluded.revision, issued_at=excluded.issued_at, expires_at=excluded.expires_at,payload=excluded.payload
          WHERE excluded.revision>reports.revision AND excluded.issued_at>=reports.issued_at AND excluded.expires_at>=reports.expires_at`;

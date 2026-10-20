PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS reports (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  publisher TEXT NOT NULL,
  tweet_id TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  payload TEXT NOT NULL,
  UNIQUE(publisher,tweet_id)
);
CREATE INDEX IF NOT EXISTS reports_tweet ON reports(tweet_id);
CREATE INDEX IF NOT EXISTS reports_bucket_seq ON reports(bucket,seq);
CREATE INDEX IF NOT EXISTS reports_expiry ON reports(expires_at);
CREATE TABLE IF NOT EXISTS capacity (id INTEGER PRIMARY KEY CHECK(id=1), records INTEGER NOT NULL);
INSERT OR IGNORE INTO capacity VALUES(1,0);
CREATE TRIGGER IF NOT EXISTS bound_reports BEFORE INSERT ON reports
WHEN NOT EXISTS (SELECT 1 FROM reports WHERE publisher=NEW.publisher AND tweet_id=NEW.tweet_id)
BEGIN
  SELECT CASE WHEN (SELECT records FROM capacity WHERE id=1)>=60000 THEN RAISE(ABORT,'relay_capacity') END;
  SELECT CASE WHEN (SELECT COUNT(*) FROM reports WHERE tweet_id=NEW.tweet_id)>=16 THEN RAISE(ABORT,'tweet_capacity') END;
END;
CREATE TRIGGER IF NOT EXISTS count_reports_insert AFTER INSERT ON reports BEGIN UPDATE capacity SET records=records+1 WHERE id=1; END;
CREATE TRIGGER IF NOT EXISTS count_reports_delete AFTER DELETE ON reports BEGIN UPDATE capacity SET records=records-1 WHERE id=1; END;

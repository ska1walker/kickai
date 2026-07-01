-- Default-Kader (22 echte 25/26-Anker) — optional nach schema.sql ausführen.
-- Ohne diese Zeilen fällt die App automatisch auf den eingebauten Seed zurück.
insert into squad_players (id, name, club, position, exp_points, mv) values
  ('pl-k00118051','Backhaus','bremen','TW',6.76,1.5),
  ('pl-k00054360','Batz','mainz','TW',4.41,0.5),
  ('pl-k00039161','Ulreich','bayern','TW',0.44,0.5),
  ('pl-k00081053','Coufal','hoffenheim','ABW',7.0,1.8),
  ('pl-k00155823','Vuskovic','hsv','ABW',6.26,1.6),
  ('pl-k00096140','N. Schlotterbeck','dortmund','ABW',6.38,3.4),
  ('pl-k00087750','Raum','leipzig','ABW',6.12,3.2),
  ('pl-k00161346','Coulibaly','bremen','ABW',2.41,0.5),
  ('pl-k00149673','Behrens','heidenheim','ABW',2.26,0.5),
  ('pl-k00149407','Ogbus','freiburg','ABW',1.59,0.5),
  ('pl-k00059041','Kramaric','hoffenheim','MF',8.12,3.8),
  ('pl-k00102800','Baumgartner','leipzig','MF',7.53,2.3),
  ('pl-k00088240','Aleix Garcia','leverkusen','MF',6.56,2.3),
  ('pl-k00159629','S. El Mala','koeln','MF',6.53,1.7),
  ('pl-k00104010','Niehues','heidenheim','MF',2.53,0.8),
  ('pl-k00151366','Culbreath','leverkusen','MF',1.06,0.5),
  ('pl-k00168200','Covic','bremen','MF',0.65,0.5),
  ('pl-k00070605','Kane','bayern','ST',11.97,8.5),
  ('pl-k00176299','Y. Diomande','leipzig','ST',8.03,1.6),
  ('pl-k00174794','Touré','hoffenheim','ST',5.68,2.0),
  ('pl-k00094599','Schimmer','heidenheim','ST',2.29,0.6),
  ('pl-k00158876','Musah','bremen','ST',0.5,0.5)
on conflict (id) do nothing;

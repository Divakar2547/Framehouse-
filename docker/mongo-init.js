// MongoDB replica set init script
// Runs once when the container is first created.
// The healthcheck also calls rs.initiate() so this is a belt-and-suspenders guard.
try {
  const status = rs.status();
  print('Replica set already initialised: ' + status.set);
} catch (e) {
  print('Initialising replica set rs0...');
  const result = rs.initiate({
    _id: 'rs0',
    members: [{ _id: 0, host: 'mongo:27017' }],
  });
  print('rs.initiate() result: ' + JSON.stringify(result));
}

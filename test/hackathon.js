const {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require("@openzeppelin/test-helpers");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");

const { sha3 } = require("web3-utils");

const DAH = artifacts.require("DAH");

contract("DAH", (accounts) => {
  let hackathonInstance;
  const accountOwner = accounts[0];
  const accountSuperadmin = accountOwner;
  const accountAdmin = accounts[2];
  const accountJuror = accounts[3];
  const accountParticipant = accounts[4];
  const accountParticipant2 = accounts[5];
  const accountGuest = accounts[6];
  const accountGuest2 = accounts[7];
  const accountGuest3 = accounts[8];
  const accountGuest4 = accounts[9];
  const accountInitialMapping = "0x0000000000000000000000000000000000000001";

  beforeEach(async function () {
    hackathonInstance = await DAH.new();
    await assignAdmin(hackathonInstance, accountOwner, accountAdmin);
    await hackathonInstance.assignJuror(accountJuror, [1, 2], [3, 3], {
      from: accountAdmin,
    });
  });

  async function putInHackingPhase(instance, caller) {
    await assignParticipant(instance, accountParticipant, "foo");
    await assignParticipant(instance, accountParticipant2, "bar");
    await assignParticipant(instance, accountGuest, "baz");
    await assignParticipant(instance, accountGuest2, "boo");
    await assignParticipant(instance, accountGuest3, "zip");
    await assignParticipant(instance, accountGuest4, "bam");

    await instance.createTeam('foo', {from: accountParticipant});
    await instance.createTeam('bar', {from: accountParticipant2});
    const created_team_counter = await instance.teamOwnedByOwner.call(accountParticipant, { from: accountParticipant });
    const created_team_counter2 = await instance.teamOwnedByOwner.call(accountParticipant2, { from: accountParticipant });

    await instance.joinTeam(created_team_counter, {from: accountGuest});
    await instance.joinTeam(created_team_counter, {from: accountGuest2});
    await instance.joinTeam(created_team_counter2, {from: accountGuest3});
    await instance.joinTeam(created_team_counter2, {from: accountGuest4});

    await instance.setHackathonPhaseToHacking({ from: caller });
  }

  async function putInVotingPhase(instance, caller) {
    await putInHackingPhase(instance, caller);
    await instance.setHackathonPhaseToVoting({ from: caller });
  }

  async function putInFinishedPhase(instance, caller) {
    await putInVotingPhase(instance, caller);
    await instance.setHackathonPhaseToFinished({ from: caller });
  }

  async function assignAdmin(instance, caller, accountToBecomeAdmin) {
    await instance.grantRole(sha3("ADMIN_ROLE"), accountToBecomeAdmin, {
      from: caller,
    });
  }

  async function assignParticipant(
    instance,
    accountToBecomeParticipant,
    token = "foo"
  ) {
    await instance.addRegistrationTokens(
      [token].map((x) => web3.utils.sha3(x)),
      { from: accountAdmin }
    );

    await instance.joinHackathon(token, { from: accountToBecomeParticipant });
  }

  async function revokeAdmin(instance, caller, accountToRevokeAdmin) {
    await instance.revokeRole(sha3("ADMIN_ROLE"), accountToRevokeAdmin, {
      from: caller,
    });
  }

  it('can be put to hacking phase by an admin when in registration phase', async () => {

    // initial
    let status = await hackathonInstance.hackathonStatus.call();
    assert.equal(status, DAH.HackathonStatus.Registration);
    
    // action
    await putInHackingPhase(hackathonInstance, accountAdmin);

    // assert
    status = await hackathonInstance.hackathonStatus.call();
    assert.equal(status, DAH.HackathonStatus.Hacking);
  });

  it('can NOT be put to hacking phase if there are less than 2 teams', async () => {
    // initial
    let status = await hackathonInstance.hackathonStatus.call();
    assert.equal(status, DAH.HackathonStatus.Registration);

    // assert
    await expectRevert(hackathonInstance.setHackathonPhaseToHacking({from: accountAdmin}), "There need to be at least 2 teams.");
  });

  it('can NOT be put to hacking phase by an admin when in voting phase', async () => {

    // initial
    await putInVotingPhase(hackathonInstance, accountAdmin);
    let status = await hackathonInstance.hackathonStatus.call();
    assert.equal(status, DAH.HackathonStatus.Voting);

    // action
    await expectRevert(hackathonInstance.setHackathonPhaseToHacking({from: accountAdmin}), "The hackathon is not in registration mode.");

  });

  it('can NOT be put to hacking phase by an admin when in finished phase', async () => {

    // initial
    await putInFinishedPhase(hackathonInstance, accountAdmin);
    let status = await hackathonInstance.hackathonStatus.call();
    assert.equal(status, DAH.HackathonStatus.Finished);

    // action
    await expectRevert(hackathonInstance.setHackathonPhaseToHacking({from: accountAdmin}), "The hackathon is not in registration mode.");

  });

  it('can NOT be put to hacking phase by a GUEST', async () => {
    // action
    await expectRevert(hackathonInstance.setHackathonPhaseToHacking({from: accountGuest}),
    `AccessControl: account ${ accountGuest.toLowerCase() } is missing role admin`);

  });

  it('can be put to voting phase by an admin when in hacking phase', async () => {
    // initial
    await putInHackingPhase(hackathonInstance, accountAdmin);
    let status = await hackathonInstance.hackathonStatus.call();
    assert.equal(status, DAH.HackathonStatus.Hacking);

    // action
    await hackathonInstance.setHackathonPhaseToVoting({from: accountAdmin});

    // assert
    status = await hackathonInstance.hackathonStatus.call();
    assert.equal(status, DAH.HackathonStatus.Voting);
  });

  it('can NOT be put to voting phase by an admin when in registration phase', async () => {
    // initial
    let status = await hackathonInstance.hackathonStatus.call();
    assert.equal(status, DAH.HackathonStatus.Registration);

    // assert
    await expectRevert(
      hackathonInstance.setHackathonPhaseToVoting({from: accountAdmin}),
      "The hackathon is not in hacking mode"
    );
  });

  it('can NOT be put to voting phase by an admin when in finished phase', async () => {
    // initial
    await putInFinishedPhase(hackathonInstance, accountAdmin);
    let status = await hackathonInstance.hackathonStatus.call();
    assert.equal(status, DAH.HackathonStatus.Finished);

    // assert
    await expectRevert(
      hackathonInstance.setHackathonPhaseToVoting({from: accountAdmin}),
      "The hackathon is not in hacking mode"
    );
  });

  it('can NOT be put to voting phase by a GUEST', async () => {
    await putInHackingPhase(hackathonInstance, accountAdmin);

    // action
    await expectRevert(hackathonInstance.setHackathonPhaseToVoting({from: accountGuest}),
    `AccessControl: account ${ accountGuest.toLowerCase() } is missing role admin`);
  });

  it('can be put to voting phase by an admin when in voting phase', async () => {
    // initial
    await putInVotingPhase(hackathonInstance, accountAdmin);
    let status = await hackathonInstance.hackathonStatus.call();
    assert.equal(status, DAH.HackathonStatus.Voting);

    // action
    await hackathonInstance.setHackathonPhaseToFinished({from: accountAdmin});

    // assert
    status = await hackathonInstance.hackathonStatus.call();
    assert.equal(status, DAH.HackathonStatus.Finished);
  });

  it('can NOT be put to finished phase by an admin when in registration phase', async () => {
    // initial
    let status = await hackathonInstance.hackathonStatus.call();
    assert.equal(status, DAH.HackathonStatus.Registration);

    // assert
    await expectRevert(
      hackathonInstance.setHackathonPhaseToFinished({from: accountAdmin}),
      "The hackathon is not in voting mode"
    );
  });

  it('can NOT be put to finished phase by an admin when in hacking phase', async () => {
    // initial
    await putInHackingPhase(hackathonInstance, accountAdmin);
    let status = await hackathonInstance.hackathonStatus.call();
    assert.equal(status, DAH.HackathonStatus.Hacking);

    // assert
    await expectRevert(
      hackathonInstance.setHackathonPhaseToFinished({from: accountAdmin}),
      "The hackathon is not in voting mode"
    );
  });

  it('can NOT be put to finished phase by a GUEST', async () => {
    await putInVotingPhase(hackathonInstance, accountAdmin);

    // action
    await expectRevert(hackathonInstance.setHackathonPhaseToFinished({from: accountGuest}),
    `AccessControl: account ${ accountGuest.toLowerCase() } is missing role admin`);
  });

  it('can add registration tokens by admin in preparation phase', async () => {
    let status = await hackathonInstance.hackathonStatus.call();
    assert.equal(status, DAH.HackathonStatus.Registration);

    await hackathonInstance.addRegistrationTokens(['foo', 'bar'].map(x => web3.utils.sha3(x)), { from: accountAdmin });

    const valueFoo = await hackathonInstance.registrationTokens.call(web3.utils.soliditySha3('foo'), { from: accountAdmin });
    assert.equal(accountInitialMapping, valueFoo);
    const valueBar = await hackathonInstance.registrationTokens.call(web3.utils.soliditySha3('bar'), { from: accountAdmin });
    assert.equal(accountInitialMapping, valueBar);
    const valueBaz = await hackathonInstance.registrationTokens.call(web3.utils.soliditySha3('baz'), { from: accountAdmin });
    assert.equal(constants.ZERO_ADDRESS, valueBaz);
  });

  it('can NOT add registration tokens by GUEST in preparation phase', async () => {
    let status = await hackathonInstance.hackathonStatus.call();
    assert.equal(status, DAH.HackathonStatus.Registration);

    await expectRevert(
      hackathonInstance.addRegistrationTokens(['foo', 'bar'].map(x => web3.utils.sha3(x)), { from: accountGuest }),
      `AccessControl: account ${ accountGuest.toLowerCase() } is missing role admin`
    );
  });

  it('can NOT add registration token in hacking phase', async () => {
    // initial
    await putInHackingPhase(hackathonInstance, accountAdmin);
    let status = await hackathonInstance.hackathonStatus.call();
    assert.equal(status, DAH.HackathonStatus.Hacking);

    // assert
    await expectRevert(
      hackathonInstance.addRegistrationTokens(['foo', 'bar'].map(x => web3.utils.sha3(x)), { from: accountAdmin }),
      "The hackathon is not in registration mode"
    );
  });

  it('can NOT add registration token in voting phase', async () => {
    // initial
    await putInVotingPhase(hackathonInstance, accountAdmin);
    let status = await hackathonInstance.hackathonStatus.call();
    assert.equal(status, DAH.HackathonStatus.Voting);

    // assert
    await expectRevert(
      hackathonInstance.addRegistrationTokens(['foo', 'bar'].map(x => web3.utils.sha3(x)), { from: accountAdmin }),
      "The hackathon is not in registration mode"
    );
  });

  it('can NOT add registration token in finished phase', async () => {
    // initial
    await putInFinishedPhase(hackathonInstance, accountAdmin);
    let status = await hackathonInstance.hackathonStatus.call();
    assert.equal(status, DAH.HackathonStatus.Finished);

    // assert
    await expectRevert(
      hackathonInstance.addRegistrationTokens(['foo', 'bar'].map(x => web3.utils.sha3(x)), { from: accountAdmin }),
      "The hackathon is not in registration mode"
    );
  });

  it('can assign jurors by admin', async () => {
    let status = await hackathonInstance.hackathonStatus.call();
    assert.equal(status, DAH.HackathonStatus.Registration);

    await hackathonInstance.assignJuror(accountGuest, [1,2], [3,3], { from: accountAdmin });

    const isGuestJuror = await hackathonInstance.hasRole(sha3("JUROR_ROLE"), accountGuest, { from: accountAdmin });
    const isGuest2Juror = await hackathonInstance.hasRole(sha3("JUROR_ROLE"), accountGuest2, { from: accountAdmin });

    assert.equal(isGuestJuror, true);
    assert.equal(isGuest2Juror, false);
  });

  it('can NOT assign jurors by guest', async () => {
    await expectRevert(
      hackathonInstance.assignJuror(accountGuest2, [1,2], [3,3], { from: accountGuest }),
      `AccessControl: account ${ accountGuest.toLowerCase() } is missing role admin`
    );
  });

  it('does allow superadmin to assign admin', async () => {

      await assignAdmin(hackathonInstance, accountSuperadmin, accountGuest);
      const isGuestAdmin = await hackathonInstance.hasRole(sha3("ADMIN_ROLE"), accountGuest, { from: accountAdmin });
      const isGuest2Admin = await hackathonInstance.hasRole(sha3("ADMIN_ROLE"), accountGuest2, { from: accountAdmin });

      assert.equal(isGuestAdmin, true);
      assert.equal(isGuest2Admin, false);
  });

  it('does not allow admin to assign admin', async () => {
    await expectRevert(
      assignAdmin(hackathonInstance, accountAdmin, accountGuest),
      `AccessControl: account ${ accountAdmin.toLowerCase() } is missing role superadmin`
    );
  });

  it('does allow superadmin to assign admin', async () => {

      await hackathonInstance.grantRole(sha3("ADMIN_ROLE"), accountGuest, { from: accountSuperadmin });
      const isGuestAdmin = await hackathonInstance.hasRole(sha3("ADMIN_ROLE"), accountGuest, { from: accountAdmin });
      const isGuest2Admin = await hackathonInstance.hasRole(sha3("ADMIN_ROLE"), accountGuest2, { from: accountAdmin });

      assert.equal(isGuestAdmin, true);
      assert.equal(isGuest2Admin, false);
  });

  it('does allow superadmin to remove admin', async () => {

      await assignAdmin(hackathonInstance, accountSuperadmin, accountGuest);
      let isGuestAdmin = await hackathonInstance.hasRole(sha3("ADMIN_ROLE"), accountGuest, { from: accountAdmin });
      const isGuest2Admin = await hackathonInstance.hasRole(sha3("ADMIN_ROLE"), accountGuest2, { from: accountAdmin });

      assert.equal(isGuestAdmin, true);
      assert.equal(isGuest2Admin, false);

      await revokeAdmin(hackathonInstance, accountSuperadmin, accountGuest);

      isGuestAdmin = await hackathonInstance.hasRole(sha3("ADMIN_ROLE"), accountGuest, { from: accountAdmin });
      assert.equal(isGuestAdmin, false);
  });

  it('does NOT allow admin to remove another admin', async () => {

      await assignAdmin(hackathonInstance, accountSuperadmin, accountGuest);
      let isGuestAdmin = await hackathonInstance.hasRole(sha3("ADMIN_ROLE"), accountGuest, { from: accountAdmin });
      const isGuest2Admin = await hackathonInstance.hasRole(sha3("ADMIN_ROLE"), accountGuest2, { from: accountAdmin });

      assert.equal(isGuestAdmin, true);
      assert.equal(isGuest2Admin, false);

      await expectRevert(
        revokeAdmin(hackathonInstance, accountAdmin, accountGuest),
        `AccessControl: account ${ accountAdmin.toLowerCase() } is missing role superadmin`
      );
  });

  it('does allow participant to create a team', async () => {

      await assignParticipant(hackathonInstance, accountParticipant, "foo");
      await assignParticipant(hackathonInstance, accountParticipant2, "bar");

      const next_teamNFTCounter =  parseInt( await hackathonInstance.teamNFTCounter.call() );
      await hackathonInstance.createTeam("foo", { from: accountParticipant });
      await hackathonInstance.createTeam("bar", { from: accountParticipant2 });

      const created_team_counter = await hackathonInstance.teamOwnedByOwner.call(accountParticipant, { from: accountAdmin });
      const created_team2_counter = await hackathonInstance.teamOwnedByOwner.call(accountParticipant2, { from: accountAdmin });

      assert.equal(next_teamNFTCounter , created_team_counter);
      assert.equal(next_teamNFTCounter + 1, created_team2_counter);
  });

  it("does NOT allow an account without participant role to create a team", async () => {
    await expectRevert(
      hackathonInstance.createTeam("foo", { from: accountGuest }),
      `AccessControl: account ${accountGuest.toLowerCase()} is missing role participant`
    );
  });

  it('does NOT allow a participant to create more than one team', async () => {

      await assignParticipant(hackathonInstance, accountParticipant, "foo");

      const next_teamNFTCounter =  parseInt( await hackathonInstance.teamNFTCounter.call() );
      await hackathonInstance.createTeam("foo", { from: accountParticipant });

      const created_team_counter = await hackathonInstance.teamOwnedByOwner.call(accountParticipant, { from: accountAdmin });

      assert.equal(next_teamNFTCounter , created_team_counter);

      await expectRevert(
        hackathonInstance.createTeam("foo", { from: accountParticipant }),
        `Account ${accountParticipant.toLowerCase()} already created a team`
      );
  });

  it("can create a price category by admin role", async () => {
    const isAdminAdmin = await hackathonInstance.hasRole(
      sha3("ADMIN_ROLE"),
      accountAdmin,
      { from: accountAdmin }
    );

    assert.equal(isAdminAdmin, true);

    await hackathonInstance.createPrizeCategory("foo", { from: accountAdmin });

    const prizeCategory = await hackathonInstance.prizeCategories.call(
      web3.utils.soliditySha3("foo"),
      { from: accountAdmin }
    );

    assert.equal(prizeCategory[0], "foo");
  });

  it("doesn't allow a prize category to be created twice with the same name", async () => {
    const isAdminAdmin = await hackathonInstance.hasRole(
      sha3("ADMIN_ROLE"),
      accountAdmin,
      { from: accountAdmin }
    );

    assert.equal(isAdminAdmin, true);

    await hackathonInstance.createPrizeCategory("foo", { from: accountAdmin });
    await expectRevert(
      hackathonInstance.createPrizeCategory("foo", { from: accountAdmin }),
      `There's already a prize with the name foo`
    );
  });

  it("allows a participant to register", async () => {
    await hackathonInstance.addRegistrationTokens(["foo"].map(x => web3.utils.sha3(x)), {from: accountAdmin});

    await hackathonInstance.joinHackathon("foo", { from: accountGuest });

    
  });

  it("doesn't allow a registration token to be used twice", async () => {
    await hackathonInstance.addRegistrationTokens(["foo", "bar"].map(x => web3.utils.sha3(x)), {from: accountAdmin});

    await hackathonInstance.joinHackathon("foo", { from: accountGuest });

    await expectRevert(
      hackathonInstance.joinHackathon("foo", { from: accountGuest2 }),
      "This registration token has already been used"
    );
  });

  it("doesn't allow an address to register twice", async () => {
    await hackathonInstance.addRegistrationTokens(["foo", "bar"].map(x => web3.utils.sha3(x)), {from: accountAdmin});

    await hackathonInstance.joinHackathon("foo", { from: accountGuest });

    await expectRevert(
      hackathonInstance.joinHackathon("bar", { from: accountGuest }),
      "This address already joined the hackathon"
    );
  });

  it("allows a participant to join a team", async () => {
    await assignParticipant(hackathonInstance, accountGuest, "foo");
    await assignParticipant(hackathonInstance, accountGuest2, "bar");

    await hackathonInstance.createTeam("lambo bros", {from: accountGuest});

    const teamId = await hackathonInstance.teamNFTCounter.call({from: accountGuest});

    await hackathonInstance.joinTeam(teamId, { from: accountGuest2 });
    const returnedTeamId = await hackathonInstance.participantTeam.call(accountGuest2, {from: accountGuest2});

    assert.equal(teamId.toString(), returnedTeamId.toString());
  });

  it("does not allow more participants in a team than the max size", async () => {

    assert.equal(await hackathonInstance.MAX_MEMBERS_PER_TEAM.call({from: accountAdmin}), 4);

    await assignParticipant(hackathonInstance, accountParticipant, "foo");
    await assignParticipant(hackathonInstance, accountParticipant2, "bar");
    await assignParticipant(hackathonInstance, accountGuest, "baz");
    await assignParticipant(hackathonInstance, accountGuest2, "pow");
    await assignParticipant(hackathonInstance, accountGuest3, "bam");

    await hackathonInstance.createTeam("lambo bros", {from: accountParticipant});

    const teamId = await hackathonInstance.teamNFTCounter.call({from: accountParticipant}) - 1;

    await hackathonInstance.joinTeam(teamId, { from: accountParticipant2 });
    await hackathonInstance.joinTeam(teamId, { from: accountGuest });
    await hackathonInstance.joinTeam(teamId, { from: accountGuest2 });

    await expectRevert(
          hackathonInstance.joinTeam(teamId, { from: accountGuest3 }),
          "This team already has the maximum amount of members"
        );
  });
  it("does not allow a participant to join two teams", async () => {

    assert.equal(await hackathonInstance.MAX_MEMBERS_PER_TEAM.call({from: accountAdmin}), 4);

    await assignParticipant(hackathonInstance, accountParticipant, "foo");
    await assignParticipant(hackathonInstance, accountParticipant2, "bar");

    await hackathonInstance.createTeam("lambo bros", {from: accountParticipant});
    await hackathonInstance.createTeam("mercedes bros", {from: accountParticipant2});

    const teamId = await hackathonInstance.teamNFTCounter.call({from: accountParticipant});

    await expectRevert(
          hackathonInstance.joinTeam(teamId, { from: accountParticipant2 }),
          "This account already joined a team"
        );
  });

  it("mints an nft for every participant when hackathon is started", async () => {
    await assignParticipant(hackathonInstance, accountParticipant, "foo");
    await assignParticipant(hackathonInstance, accountParticipant2, "bar");
    await assignParticipant(hackathonInstance, accountGuest, "baz");
    await assignParticipant(hackathonInstance, accountGuest2, "bam");
    await assignParticipant(hackathonInstance, accountGuest3, "bow");
    await assignParticipant(hackathonInstance, accountGuest4, "pom");

    await hackathonInstance.createTeam('foo', {from: accountParticipant});
    await hackathonInstance.createTeam('bar', {from: accountParticipant2});
    const created_team_counter = await hackathonInstance.teamOwnedByOwner.call(accountParticipant, { from: accountParticipant });
    const created_team_counter2 = await hackathonInstance.teamOwnedByOwner.call(accountParticipant2, { from: accountParticipant });

    await hackathonInstance.joinTeam(created_team_counter, {from: accountGuest});
    await hackathonInstance.joinTeam(created_team_counter, {from: accountGuest2});
    await hackathonInstance.joinTeam(created_team_counter2, {from: accountGuest3});
    await hackathonInstance.joinTeam(created_team_counter2, {from: accountGuest4});
    await hackathonInstance.setHackathonPhaseToHacking({from: accountAdmin});

    const balanceParticipant1 = await hackathonInstance.balanceOf(accountParticipant, created_team_counter);
    const balanceParticipant2 = await hackathonInstance.balanceOf(accountParticipant2, created_team_counter2);
    const balanceGuest = await hackathonInstance.balanceOf(accountGuest, created_team_counter2);

    assert.equal(balanceParticipant1, 1);
    assert.equal(balanceParticipant2, 1);
    assert.equal(balanceGuest, 0);
  });

  it("will not go to hacking phase if teams have less than minimum team size", async () => {
    await assignParticipant(hackathonInstance, accountParticipant, "foo");
    await assignParticipant(hackathonInstance, accountParticipant2, "bar");

    await hackathonInstance.createTeam("foo", { from: accountParticipant });
    await hackathonInstance.createTeam("bar", { from: accountParticipant2 });

    await expectRevert(
      hackathonInstance.setHackathonPhaseToHacking({ from: accountAdmin }),
      "Every team needs the minimum amount of members"
    );
  });

  it("can correctly determine the winner", async () => {
    await putInVotingPhase(hackathonInstance, accountAdmin);
    
    await hackathonInstance.createPrizeCategory('foo', {from: accountAdmin});

    const teamIdParticipant = await hackathonInstance.participantTeam.call(accountParticipant, {from: accountAdmin});
    const teamIdParticipant2 = await hackathonInstance.participantTeam.call(accountParticipant2, {from: accountAdmin});

    await hackathonInstance.vote(teamIdParticipant2, 'foo', {from: accountJuror});

    const winner = await hackathonInstance.getWinner("foo");

    assert.equal(teamIdParticipant2, winner.id);

    await hackathonInstance.vote(teamIdParticipant, 'foo', {from: accountJuror});
    await hackathonInstance.vote(teamIdParticipant, 'foo', {from: accountJuror});
    
    const newWinner = await hackathonInstance.getWinner("foo");

    assert.equal(teamIdParticipant, newWinner.id);
  });


  it("requires juror role to vote", async () => {
    await putInVotingPhase(hackathonInstance, accountAdmin);
    
    await hackathonInstance.createPrizeCategory('foo', {from: accountAdmin});
    
    const teamIdParticipant = await hackathonInstance.participantTeam.call(accountParticipant, {from: accountAdmin});

    await expectRevert(
      hackathonInstance.vote(teamIdParticipant, 'foo', {from: accountGuest}),
      `AccessControl: account ${ accountGuest.toLowerCase() } is missing role juror`
    );
  });

  it("can not stand draws", async () => {
    await putInVotingPhase(hackathonInstance, accountAdmin);
    
    await hackathonInstance.createPrizeCategory('foo', {from: accountAdmin});

    const teamIdParticipant = await hackathonInstance.participantTeam.call(accountParticipant, {from: accountAdmin});
    const teamIdParticipant2 = await hackathonInstance.participantTeam.call(accountParticipant2, {from: accountAdmin});

    await hackathonInstance.vote(teamIdParticipant, 'foo', {from: accountJuror});
    await hackathonInstance.vote(teamIdParticipant2, 'foo', {from: accountJuror});
    await expectRevert( 
      hackathonInstance.getWinner("foo"),
      "A draw is not allowed, keep on voting!"
    );
  });

  it("does not allow to vote for your own team", async () => {
    
    await assignParticipant(hackathonInstance, accountJuror, "foo");
    await assignParticipant(hackathonInstance, accountParticipant, "foz");
    await assignParticipant(hackathonInstance, accountParticipant2, "bar");
    await assignParticipant(hackathonInstance, accountGuest, "baz");
    await assignParticipant(hackathonInstance, accountGuest2, "boo");
    await assignParticipant(hackathonInstance, accountGuest3, "zip");

    await hackathonInstance.createTeam('fooTeam', {from: accountJuror});
    const teamIdJuror = await hackathonInstance.participantTeam.call(accountJuror, {from: accountAdmin});
    await hackathonInstance.createTeam('fooTeam', {from: accountParticipant});
    const teamIdParticipant = await hackathonInstance.participantTeam.call(accountParticipant, {from: accountAdmin});

    await hackathonInstance.joinTeam(teamIdJuror, {from: accountGuest});
    await hackathonInstance.joinTeam(teamIdJuror, {from: accountGuest2});
    await hackathonInstance.joinTeam(teamIdParticipant, {from: accountGuest3});
    await hackathonInstance.joinTeam(teamIdParticipant, {from: accountParticipant2});

    await hackathonInstance.setHackathonPhaseToHacking();
    await hackathonInstance.setHackathonPhaseToVoting();

    await hackathonInstance.createPrizeCategory('fooPrize', {from: accountAdmin});

    await expectRevert( 
      hackathonInstance.vote(teamIdJuror, 'fooPrize', {from: accountJuror}),
      "You can't vote for your own team"
    );
  });

  it("mints winner NFTs", async () => {
    await putInVotingPhase(hackathonInstance, accountAdmin);
    
    await hackathonInstance.createPrizeCategory('foo', {from: accountAdmin});

    const teamIdParticipant = await hackathonInstance.participantTeam.call(accountParticipant, {from: accountAdmin});

    await hackathonInstance.vote(teamIdParticipant, 'foo', {from: accountJuror});

    await hackathonInstance.setHackathonPhaseToFinished();

    const prizeCategory = await hackathonInstance.prizeCategories.call(web3.utils.soliditySha3('foo'));

    const winner = await hackathonInstance.getWinner("foo");
    assert.equal(teamIdParticipant, winner.id);

    const balanceParticipant = await hackathonInstance.balanceOf(accountParticipant, prizeCategory.winnerTokenId);
    const balanceParticipant2 = await hackathonInstance.balanceOf(accountParticipant2, prizeCategory.winnerTokenId);
    const balanceGuest = await hackathonInstance.balanceOf(accountGuest, prizeCategory.winnerTokenId);
    const balanceGuest2 = await hackathonInstance.balanceOf(accountGuest2, prizeCategory.winnerTokenId);

    assert.equal(balanceParticipant, 1);
    assert.equal(balanceGuest, 1);
    assert.equal(balanceGuest2, 1);
    assert.equal(balanceParticipant2, 0);
  });

  // - a team can be removed
  // - only register with valid code
  // - You don't have vote tokens for this category
  // - when draw, there is a mechanism (currently out of scope)
  // - team owner can accept participants (currently out of scope)
});

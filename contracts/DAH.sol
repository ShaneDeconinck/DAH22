// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

/// @title Decentralized Autonomous Hackathon contract
/// @author Shane Deconinck
contract DAH is ERC1155, AccessControl {
    /********************************
     * HARD CODED PARAMETERS         *
     * Change these as desired       *
     *********************************/

    uint32 public constant MIN_MEMBERS_PER_TEAM = 3;
    uint32 public constant MAX_MEMBERS_PER_TEAM = 4;

    /********************************
     *   STATUS                      *
     *********************************/

    // The possible phases of the hackaton
    enum HackathonStatus {
        Registration,
        Hacking,
        Voting,
        Finished
    }

    // The current status of the hackathon
    HackathonStatus public hackathonStatus;

    /********************************
     *   ROLES                       *
     *********************************/

    bytes32 public constant PARTICIPANT_ROLE = keccak256("PARTICIPANT_ROLE");
    bytes32 public constant JUROR_ROLE = keccak256("JUROR_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /********************************
     *   VOTES & AWARDS              *
     *********************************/

    struct PrizeCategory {
        string name;
        uint16 voteId;
        uint16 winnerTokenId;
        bool exists;
    }

    mapping(bytes32 => PrizeCategory) public prizeCategories;
    string[] public prizeCategoryNames;

    uint16 private nextAvailableVoteTokenId;
    uint16 private nextAvailableWinnerTokenId;

    /// mapping from teamId to mapping voteCategoryId -> numberOfVotes
    mapping(uint256 => mapping(bytes32 => uint16)) private teamVotes;

    /********************************
     *   REGISTRATION                *
     *********************************/

    /* this mapping holds the hashes of the registration tokens, 
        and maps them to the addresses once they're consumed  */
    mapping(bytes32 => address) public registrationTokens;

    address constant REGISTRATION_TOKEN_AVAILABLE = address(1);

    /********************************
     *   TEAMS AND TEAM NFTs         *
     *********************************/

    struct Team {
        uint256 id;
        string name;
    }

    /// @dev this variable holds the teams of the hackathon
    Team[] public teams;

    mapping(address => uint256) public teamOwnedByOwner;
    mapping(uint256 => address[]) public teamParticipants;
    mapping(address => uint256) public participantTeam;

    uint256 constant REGISTERED_NO_TEAM = 1;

    /********************************
     *   TOKEN IDs                   *
     *********************************/

    // Vote tokens start at 1 (max 49)
    // Team tokens start at 50 (max 99)
    // Winner tokens start at 100

    uint16 private constant START_VOTE_TOKEN_ID = 1;
    uint256 public teamNFTCounter = 50;
    uint16 private constant START_WINNER_TOKEN_ID = 100;

    constructor() ERC1155("<<ipfs_folder_url>>/{id}.json") {
        // grant the contract deployer the default admin role: it will be able
        // to grant and revoke any roles
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(ADMIN_ROLE, _msgSender());

        // set the hackathon status to `Registration`
        hackathonStatus = HackathonStatus.Registration;

        // initialize the variables that track the next available IDs
        nextAvailableVoteTokenId = START_VOTE_TOKEN_ID;
        nextAvailableWinnerTokenId = START_WINNER_TOKEN_ID;

        // set the admin for the rjuror and participant role
        _setRoleAdmin(JUROR_ROLE, ADMIN_ROLE);
        _setRoleAdmin(PARTICIPANT_ROLE, ADMIN_ROLE);
    }

    /********************************
     *   MODIFIERS                   *
     *********************************/

    modifier onlyWhenHackathonHasStatus(
        HackathonStatus status,
        string memory statusName
    ) {
        require(
            hackathonStatus == status,
            string(
                abi.encodePacked(
                    "The hackathon is not in ",
                    statusName,
                    " mode."
                )
            )
        );
        _;
    }

    modifier hackathonIsNotFinished() {
        require(
            hackathonStatus != HackathonStatus.Finished,
            "The hackathon is finished."
        );
        _;
    }

    modifier isParticipant() {
        require(
            participantTeam[_msgSender()] != 0,
            string(
                abi.encodePacked(
                    "AccessControl: account ",
                    Strings.toHexString(uint160(_msgSender()), 20),
                    " is missing role participant"
                )
            )
        );
        _;
    }

    /********************************
     *   INTERNAL FUNCTIONS            *
     *********************************/

    /**
     * @dev Override to display the missing role name in the error message
     */
    function _checkRole(bytes32 role, address account) 
        internal 
        view 
        override 
    {
        require(
            hasRole(role, account),
            string(
                abi.encodePacked(
                    "AccessControl: account ",
                    Strings.toHexString(uint160(account), 20),
                    " is missing role ",
                    Strings.toHexString(uint256(role), 32)
                )
            )
        );
    }

    /********************************
     *   PUBLIC FUNCTIONS            *
     *********************************/

    /**
     * @dev This allows the contract to confirm that it inherits the interfaces of ERC1155 and AccessControl
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /********************************
     *   PUBLIC GETTERS              *
     *********************************/

    function getNumberOfTeams() 
        public 
        view 
        returns (uint256) 
    {
        return teams.length;
    }

    function getWinner(string memory prizeCategoryName)
        public
        view
        returns (Team memory)
    {
        bytes32 prizeCategory = keccak256(abi.encodePacked(prizeCategoryName));
        uint256 winningVotes = 0;
        Team memory winner = Team(0, "");
        bool draw = false;

        for (uint8 i = 0; i < teams.length; i++) {
            if (teamVotes[teams[i].id][prizeCategory] > winningVotes) {
                winningVotes = teamVotes[teams[i].id][prizeCategory];
                winner = teams[i];
                draw = false;
            } else if (teamVotes[teams[i].id][prizeCategory] == winningVotes) {
                draw = true;
            }
        }

        require(draw == false, "A draw is not allowed, keep on voting!");

        return winner;
    }

    /********************************
     *   PARTICIPANT RELATED         *
     *********************************/

    function joinHackathon(string memory token) 
        public 
    {
        require(
            registrationTokens[keccak256(bytes(token))] == REGISTRATION_TOKEN_AVAILABLE,
            "This registration token has already been used"
        );

        require(
            participantTeam[_msgSender()] != REGISTERED_NO_TEAM,
            "This address already joined the hackathon"
        );

        registrationTokens[keccak256(abi.encodePacked(token))] = _msgSender();
        participantTeam[_msgSender()] = REGISTERED_NO_TEAM;
    }

    function createTeam(string memory name) 
        public 
        isParticipant
    {
        require(
            teamOwnedByOwner[_msgSender()] == 0,
            string(
                abi.encodePacked(
                    "Account ",
                    Strings.toHexString(uint160(_msgSender()), 20),
                    " already created a team"
                )
            )
        );

        teamOwnedByOwner[_msgSender()] = teamNFTCounter;
        teamParticipants[teamNFTCounter].push(_msgSender());
        participantTeam[_msgSender()] = teamNFTCounter;
        teams.push(Team(teamNFTCounter, name));

        teamNFTCounter++;

        // team NFT minting is when hackathon is started, so that all members of the team receive an NFT
    }

    function joinTeam(uint256 teamId) 
        public 
        isParticipant
    {
        require(
            participantTeam[_msgSender()] == REGISTERED_NO_TEAM,
            "This account already joined a team"
        );

        require(
            teamParticipants[teamId].length < MAX_MEMBERS_PER_TEAM,
            "This team already has the maximum amount of members"
        );

        participantTeam[_msgSender()] = teamId;
        teamParticipants[teamId].push(_msgSender());
    }

    function leaveTeam() 
        public 
        isParticipant
    {
        participantTeam[_msgSender()] = REGISTERED_NO_TEAM;
        for (
            uint256 i = 0;
            i < teamParticipants[participantTeam[_msgSender()]].length;
            i++
        ) {
            if (
                teamParticipants[participantTeam[_msgSender()]][i] ==
                _msgSender()
            ) {
                teamParticipants[participantTeam[_msgSender()]][
                    i
                ] = teamParticipants[participantTeam[_msgSender()]][
                    teamParticipants[participantTeam[_msgSender()]].length - 1
                ];
                teamParticipants[participantTeam[_msgSender()]].pop();
            }
        }
    }

    /********************************
     *   JUROR RELATED               *
     *********************************/

    /**
     * Lets a juror vote for a team
     * @param teamId the id of the team that's being voted for
     * @param prizeCategoryName the name of the category that's being voted for
     * @dev The caller must have the `JUROR_ROLE`
     *      The status must be `Voting`
     */
    function vote(uint256 teamId, string memory prizeCategoryName)
        public
        onlyRole(JUROR_ROLE)
        onlyWhenHackathonHasStatus(HackathonStatus.Voting, "voting")
    {
        bytes32 prizeCategoryId = keccak256(
            abi.encodePacked(prizeCategoryName)
        );

        require(
            participantTeam[_msgSender()] != teamId,
            "You can't vote for your own team"
        );

        // check if the juror has votes
        require(
            balanceOf(_msgSender(), prizeCategories[prizeCategoryId].voteId) >
                0,
            "You don't have vote tokens for this category."
        );

        // if so, burn them
        _burn(_msgSender(), prizeCategories[prizeCategoryId].voteId, 1);
        teamVotes[teamId][prizeCategoryId]++;
    }

    /********************************
     *   ADMIN RELATED               *
     *********************************/

    /* ~~~~~~~~~
        Metadata
    ~~~~~~~~~~~~ */

    /**
     * @notice This allows the admin to change the metadata URI, as long as the hackathon is not finished.
     */
    function setMetadataURI(string memory newuri)
        public
        onlyRole(ADMIN_ROLE)
        hackathonIsNotFinished
    {
        _setURI(newuri);
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        Participants & Teams management
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    function removeParticipant(address participant)
        public
        onlyRole(ADMIN_ROLE)
    {
        if (participantTeam[participant] > REGISTERED_NO_TEAM) {
            for (
                uint256 i = 0;
                i < teamParticipants[participantTeam[participant]].length;
                i++
            ) {
                if (
                    teamParticipants[participantTeam[participant]][i] ==
                    participant
                ) {
                    teamParticipants[participantTeam[participant]][
                        i
                    ] = teamParticipants[participantTeam[participant]][
                        teamParticipants[participantTeam[participant]].length -
                            1
                    ];
                    teamParticipants[participantTeam[participant]].pop();
                }
            }
        }
        participantTeam[participant] = 0;
    }

    function removeTeam(uint256 teamId) public onlyRole(ADMIN_ROLE) {
        for (uint256 i = 0; i < teamParticipants[teamId].length; i++) {
            participantTeam[teamParticipants[teamId][i]] = REGISTERED_NO_TEAM;
        }
        delete teamParticipants[teamId];

        for (uint256 i = 0; i < teams.length; i++) {
            if (teams[i].id == teamId) {
                teams[i] = teams[teams.length - 1];
                teams.pop();
            }
        }

        teamOwnedByOwner[teamParticipants[teamId][0]] = 0;
    }

    /* ~~~~~~~~~~~~~~~~~
        Juror management
    ~~~~~~~~~~~~~~~~~~~~ */

    /** @notice Assigns the juror role to a juror address, and mints their vote tokens.
     * @param jurorAddress Address of the juror.
     * @param voteIds Array with the ids of the vote tokens.
     * @param voteAmounts Array with the amounts of the vote tokens.
     */
    function assignJuror(
        address jurorAddress,
        uint256[] memory voteIds,
        uint256[] memory voteAmounts
    ) 
        public 
        onlyRole(ADMIN_ROLE) 
    {
        
        // give role
        grantRole(JUROR_ROLE, jurorAddress);

        for (uint256 i = 0; i < voteIds.length; i++) {

            require(
                voteIds[i] >= 1 && voteIds[i] <= 49,
                "The vote id is not within allowed range (1-49)."
            );

            _mint(jurorAddress, voteIds[i], voteAmounts[i], "0x00");
        }
    }

    // Remove juror
    function removeJuror(address jurorAddress) 
        public 
        onlyRole(ADMIN_ROLE) 
    {
        // revoke role
        revokeRole(JUROR_ROLE, jurorAddress);
        // TODO: burn votes
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~
        Hackathon phase management
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    // Start the hackathon
    function setHackathonPhaseToHacking()
        public
        onlyRole(ADMIN_ROLE)
        onlyWhenHackathonHasStatus(HackathonStatus.Registration, "registration")
    {
        // TODO check every participant has team
        require(teams.length >= 2, "There need to be at least 2 teams");

        // for every team, mint every participant their team nft
        for (uint256 i = 0; i < teams.length; i++) {
            require(
                teamParticipants[teams[i].id].length >= MIN_MEMBERS_PER_TEAM,
                "Every team needs the minimum amount of members"
            );

            for (uint256 j = 0; j < teamParticipants[teams[i].id].length; j++) {
                _mint(teamParticipants[teams[i].id][j], teams[i].id, 1, "0x00");
            }
        }

        hackathonStatus = HackathonStatus.Hacking;
    }

    // Voting phase hackathon
    function setHackathonPhaseToVoting()
        public
        onlyRole(ADMIN_ROLE)
        onlyWhenHackathonHasStatus(HackathonStatus.Hacking, "hacking")
    {
        hackathonStatus = HackathonStatus.Voting;
    }

    // Finish the hackathon
    function setHackathonPhaseToFinished()
        public
        onlyRole(ADMIN_ROLE)
        onlyWhenHackathonHasStatus(HackathonStatus.Voting, "voting")
    {
        hackathonStatus = HackathonStatus.Finished;

        for (
            uint256 i = 0;
            i < (nextAvailableVoteTokenId - START_VOTE_TOKEN_ID);
            i++
        ) {
            Team memory winning_team = getWinner(prizeCategoryNames[i]);

            for (
                uint256 j = 0;
                j < teamParticipants[winning_team.id].length;
                j++
            ) {
                _mint(
                    teamParticipants[winning_team.id][j],
                    prizeCategories[
                        keccak256(abi.encodePacked(prizeCategoryNames[i]))
                    ].winnerTokenId,
                    1,
                    "0x00"
                );
            }
        }
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        Registration token management
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    function addRegistrationTokens(bytes32[] memory new_registrationTokens)
        public
        onlyRole(ADMIN_ROLE)
        onlyWhenHackathonHasStatus(HackathonStatus.Registration, "registration")
    {
        for (uint256 i = 0; i < new_registrationTokens.length; i++) {
            registrationTokens[new_registrationTokens[i]] = REGISTRATION_TOKEN_AVAILABLE;
        }
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        Prize category management
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    function createPrizeCategory(string memory name) 
        public 
    {
        require(
            !prizeCategories[keccak256(abi.encodePacked(name))].exists,
            string(
                abi.encodePacked("There's already a prize with the name ", name)
            )
        );
        prizeCategories[keccak256(bytes(name))] = PrizeCategory(
            name,
            nextAvailableVoteTokenId++,
            nextAvailableWinnerTokenId++,
            true
        );
        prizeCategoryNames.push(name);
    }
}

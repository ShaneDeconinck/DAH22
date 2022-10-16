# Howest x Snowball x LUCA Blockchain Hackathon 2022

This contract runs a **Decentralized Autonomous Hackathon (DAH)**.
It's built upon the **ERC1155** standard and makes use of **Role-Based Access Control**.

It supports team-based competition, in which jurors vote for categorized trophies.

## Phases

There are four phases:
1. Registration
2. Hacking
3. Voting
4. Finished

### Phase 1: Registration

During the registration phase:
* **Participants** fill out an online form to register for the hackathon.
* **Admins** generate one secret **registration key** per participant, and publish its *hash* to the *registration_tokens* mapping. They communicate the registration key privately to the participant.
* **Participants** can use this registration token to register into the **DAH**.
    * The DAH's faucet gives some MATIC to the participant.
* **Participants** can create a team:
    * Other participants can apply to join the team, which must then be approved by the team owner.
    * Participants can only join one team.
* **Admins** assign jurors

### Phase 2: Hacking

*Note: Before the hackathon can enter the *hacking* phase, each participant must be part of one team. In case participants are not present, they need to be removed by an **admin**.*

* The team NFTs are minted, and each participant gets one for their respective team.

### Phase 3: Voting

There are multiple trophies to be won:
* Public price: Each participant can vote for another team for the public price.
* Category prices:
    * Artistic award
    * Conceptual award
    * Technical award
    * Original award

Each category has a set of jurors that can vote. Each juror has *n* votes that can be cast towards teams. One team can receive multiple votes of the same juror.

### Phase 4: Finished

Once the hackathon is finished, the winning team is calculated per trophy, and the trophy NFTs are minted per participant.

In case of ties, new voting tokens are issued per juror and a new round of voting takes off. 

## Registration tokens

There's a mapping from tokens to addresses.
Unregistered will (by default) return address (0)
Unassigned matches with address address(1)
Assigned will return the actual address

## NFTs

Throughout the event NFTs are issued:
* Every participant gets an NFT representing their **participation**
* Every member of a winning team gets an NFT representing their **trophy**


## Access Control

Role-Based Access Control (RBAC) is implemented through [OpenZeppelin's AccessControl.sol](https://docs.openzeppelin.com/contracts/4.x/api/access#AccessControl)

The following roles are defined:
* DEFAULT_ADMIN_ROLE
* PARTICIPANT_ROLE
* JUDGE_ROLE
* ADMIN_ROLE

## Tokens

The vote tokens are defined per trophy, and are fungible.

* 0: VOTE_PUBLIC_CATEGORY
* 1: VOTE_ARTISTIC_CATEGORY
* 2: VOTE_CONCEPTUAL_CATEGORY
* 3: VOTE_TECHNICAL_CATEGORY
* 4: VOTE_ORIGINAL_CATEGORY

~

The trophy NFTs are minted per participant per winning team. They're NFTs, with an issuance of # of users per team.

* 69: WINNER_PUBLIC_CATEGORY
* 70: WINNER_ARTISTIC_CATEGORY
* 71: WINNER_CONCEPTUAL_CATEGORY
* 72: WINNER_TECHNICAL_CATEGORY
* 73: WINNER_ORIGINAL_CATEGORY

~

Starting at **100**, there's one Team NFT id per team 
* 100: PARTICIPATION TOKEN 1
* 101: PARTICIPATION TOKEN 2
* ...


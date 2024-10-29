use anchor_lang::prelude::*;
use num_derive::*;
use num_traits::*;

// Declare the program ID.
declare_id!("Ajc8jZmvtHKnV5DFAuwzv7mEfbxnhP2HUYm6mAN7Y86J");

const GLOBAL_STATE_SEED: &[u8] = b"global_state";
const GAME_SEED: &[u8] = b"game";

#[program]
pub mod tic_tac_toe {
    use super::*;

    // Method to initialize the global state
    pub fn initialize_global_state(ctx: Context<InitializeGlobalState>) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;
        global_state.game_count = 0; // Initializes the game counter to 0
        msg!("Global state Counter: {}", global_state.game_count);
        Ok(())
    }

    // Sets up the game and derives a unique PDA account using a global game counter.
    pub fn setup_game(ctx: Context<SetupGame>, player_one: Pubkey, player_two: Pubkey) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;
        let game = &mut ctx.accounts.game;
        
        // Set up the players of the game.
        game.players = [ctx.accounts.player_one.key(), player_two];

        // Initialize an empty board and set the state to active.
        game.turn = 1; // Turn 1 ready
        game.board = [[None; 3]; 3]; // Empty board.
        game.state = GameState::Active; // The game is active.

        // Increment the global game counter for next time.
        global_state.game_count += 1;

        Ok(())
    }

    // Initializes the game state once the account has been set up.
    pub fn start_game(ctx: Context<StartGame>) -> Result<()> {
        Ok(())
    }

    // Function to make a move in the game.
    pub fn play(ctx: Context<Play>, tile: Tile) -> Result<()> {
        let game = &mut ctx.accounts.game;

        // Check if it's the player's correct turn.
        require_keys_eq!(
            game.current_player(),
            ctx.accounts.player.key(),
            TicTacToeError::NotPlayersTurn
        );

        // Make the move.
        game.play(&tile)
    }
}

// Implementation of the game structure.
impl Game {
    // Maximum size of the game account.
    pub const MAXIMUM_SIZE: usize = (32 * 2) + 1 + (9 * (1 + 1)) + (32 + 1) + 8;

    // Checks if the game is still active.
    pub fn is_active(&self) -> bool {
        self.state == GameState::Active
    }

    // Returns the index of the player whose turn it is.
    fn current_player_index(&self) -> usize {
        ((self.turn - 1) % 2) as usize
    }

    // Returns the public key of the current player.
    pub fn current_player(&self) -> Pubkey {
        self.players[self.current_player_index()]
    }

    // Makes a move on the board.
    pub fn play(&mut self, tile: &Tile) -> Result<()> {
        require!(self.is_active(), TicTacToeError::GameAlreadyOver);

        // Check if the board position is valid and empty.
        match tile {
            tile @ Tile { row: 0..=2, column: 0..=2 } => match self.board[tile.row as usize][tile.column as usize] {
                Some(_) => return Err(TicTacToeError::TileAlreadySet.into()), // Tile already occupied.
                None => {
                    // Assign the current player's sign to the empty tile.
                    self.board[tile.row as usize][tile.column as usize] =
                        Some(Sign::from_usize(self.current_player_index()).unwrap());
                }
            },
            _ => return Err(TicTacToeError::TileOutOfBounds.into()), // Out of board bounds.
        }

        // Update the game state after the move.
        self.update_state();

        // If the game remains active, proceed to the next turn.
        if GameState::Active == self.state {
            self.turn += 1;
        }

        Ok(())
    }

    // Function to check if three tiles form a winning line.
    fn is_winning_trio(&self, trio: [(usize, usize); 3]) -> bool {
        let [first, second, third] = trio;
        self.board[first.0][first.1].is_some()
            && self.board[first.0][first.1] == self.board[second.0][second.1]
            && self.board[first.0][first.1] == self.board[third.0][third.1]
    }

    // Function to update the game state (if there's a winner or tie).
    fn update_state(&mut self) {
        // Check all row and column combinations.
        for i in 0..=2 {
            if self.is_winning_trio([(i, 0), (i, 1), (i, 2)]) {
                self.state = GameState::Won {
                    winner: self.current_player(),
                };
                return;
            }
            if self.is_winning_trio([(0, i), (1, i), (2, i)]) {
                self.state = GameState::Won {
                    winner: self.current_player(),
                };
                return;
            }
        }

        // Check diagonals.
        if self.is_winning_trio([(0, 0), (1, 1), (2, 2)])
            || self.is_winning_trio([(0, 2), (1, 1), (2, 0)])
        {
            self.state = GameState::Won {
                winner: self.current_player(),
            };
            return;
        }

        // If empty tiles remain, the game remains active.
        for row in 0..=2 {
            for column in 0..=2 {
                if self.board[row][column].is_none() {
                    return;
                }
            }
        }

        // If no empty tiles remain and no one has won, the game ends in a tie.
        self.state = GameState::Tie;
    }
}

// Structure representing the global state.
#[account]
pub struct GlobalState {
    pub game_count: u64, // Global game counter to ensure unique accounts.
}

// Structure representing each game's state.
#[account]
pub struct Game {
    players: [Pubkey; 2], // Public keys of the players (64 bytes).
    turn: u8,             // Current turn number (1 byte).
    board: [[Option<Sign>; 3]; 3], // Board state (9 positions with 2 bytes per cell).
    state: GameState,               // Current game state (won, tie, active).
}

// Enum for possible game states.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum GameState {
    Active,                 // The game is in progress.
    Tie,                    // The game ended in a tie.
    Won { winner: Pubkey }, // Someone has won the game.
}

// Enum representing player signs (X or O).
#[derive(AnchorSerialize, AnchorDeserialize, FromPrimitive, ToPrimitive, Copy, Clone, PartialEq, Eq)]
pub enum Sign {
    X,
    O,
}

// Structure representing a tile on the board.
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct Tile {
    row: u8,    // Tile row (0-2).
    column: u8, // Tile column (0-2).
}

// Account setup for `initialize_global_state` instruction.
#[derive(Accounts)]
pub struct InitializeGlobalState<'info> {
    #[account(init, payer = payer, space = 8 + 8, seeds = [GLOBAL_STATE_SEED], bump)]
    pub global_state: Account<'info, GlobalState>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// Account setup for `setup_game` instruction.
#[derive(Accounts)]
pub struct SetupGame<'info> {
    #[account(mut)]
    pub global_state: Account<'info, GlobalState>, // Global state containing the game counter.
    #[account(init, payer = player_one, space = Game::MAXIMUM_SIZE, seeds = [GAME_SEED, player_one.key().as_ref(), player_two.key().as_ref(), &global_state.game_count.to_le_bytes()], bump)]
    pub game: Account<'info, Game>, // New PDA account for the game.
    #[account(mut)]
    pub player_one: Signer<'info>,  // Player 1.
    /// CHECK: No need for player 2's signature at this stage.
    pub player_two: UncheckedAccount<'info>, // Player 2.
    pub system_program: Program<'info, System>, // Use of the system program.
}

// Account setup for `start_game` instruction.
#[derive(Accounts)]
pub struct StartGame<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>, // Game account to start.
}

// Account setup for `play` instruction.
#[derive(Accounts)]
pub struct Play<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>, // Game account where play occurs.
    #[account(mut)]
    pub player: Signer<'info>,      // Player making the move.
}

// Definition of possible errors.
#[error_code]
pub enum TicTacToeError {
    GameAlreadyOver,       // Attempt to play in a game that has already ended.
    NotPlayersTurn,        // Not the current player's turn.
    TileAlreadySet,        // Attempt to play on an occupied tile.
    TileOutOfBounds,       // Attempt to play outside the board limits.
}

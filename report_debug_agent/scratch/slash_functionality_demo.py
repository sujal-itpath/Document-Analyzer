import shlex
import sys
import inspect
from functools import reduce
from typing import Callable, Dict, Any, Tuple, List, get_type_hints

# ==============================================================================
# PART 1: SLASH COMMANDS (FUNCTIONAL ROUTING & INTERPOLATION)
# ==============================================================================

class SlashCommandRouter:
    """
    A functional registry and router for slash commands (e.g., /goal, /browser).
    Handles string parsing, type casting, and functional routing.
    """
    def __init__(self):
        self._commands: Dict[str, Tuple[Callable, str]] = {}

    def register(self, name: str, description: str = "") -> Callable:
        """
        Decorator to register a function as a slash command.
        Example:
            @router.register("goal", "Describe a goal")
            def set_goal(description: str, priority: int = 1):
                ...
        """
        def decorator(func: Callable) -> Callable:
            cmd_name = name.lstrip("/").lower()
            self._commands[cmd_name] = (func, description)
            return func
        return decorator

    def execute(self, user_input: str) -> str:
        """
        Parses user input, checks if it is a slash command, resolves types, 
        and executes the correct registered handler.
        """
        user_input = user_input.strip()
        if not user_input.startswith("/"):
            return f"[LLM/Chat Fallback] User typed: {user_input}"

        # 1. Parse command and arguments using shell-like splitting (handles quotes)
        try:
            tokens = shlex.split(user_input)
        except ValueError as e:
            return f"[ERROR] Parsing Error (check your quotes): {e}"

        if not tokens:
            return "[ERROR] Empty slash command."

        command_name = tokens[0].lstrip("/").lower()
        raw_args = tokens[1:]

        # 2. Check if the command exists
        if command_name not in self._commands:
            return f"[ERROR] Unknown command: /{command_name}. Type /help for available commands."

        handler, desc = self._commands[command_name]

        # 3. Retrieve type annotations and parameter definitions for casting
        sig = inspect.signature(handler)
        bound_args = {}
        
        # Iterate over handler parameters and cast raw string arguments
        params = list(sig.parameters.values())
        
        for i, param in enumerate(params):
            if i < len(raw_args):
                val = raw_args[i]
                # If param has a type annotation, cast the string to that type
                annotation = param.annotation
                if annotation != inspect.Parameter.empty:
                    try:
                        # Handle simple casting (int, float, bool)
                        if annotation == bool:
                            val = val.lower() in ("true", "1", "yes", "on")
                        else:
                            val = annotation(val)
                    except ValueError:
                        return f"[ERROR] Type Mismatch: Argument '{param.name}' expects {annotation.__name__}, got '{val}'."
                bound_args[param.name] = val
            elif param.default != inspect.Parameter.empty:
                # Use default value if parameter wasn't supplied
                bound_args[param.name] = param.default
            else:
                return f"[ERROR] Missing Argument: /{command_name} expects parameter '{param.name}'."

        # Detect extra arguments passed but not accepted by signature
        if len(raw_args) > len(params):
            return f"[ERROR] Too many arguments passed to /{command_name}. Expected at most {len(params)}."

        # 4. Route functionally
        try:
            result = handler(**bound_args)
            return str(result)
        except Exception as e:
            return f"[ERROR] Execution error inside /{command_name}: {e}"

    def get_help_text(self) -> str:
        """Generates usage descriptions for all registered commands."""
        help_lines = ["\n[INFO] Registered Slash Commands:"]
        for name, (handler, desc) in sorted(self._commands.items()):
            sig = inspect.signature(handler)
            params = []
            for p in sig.parameters.values():
                if p.default == inspect.Parameter.empty:
                    params.append(f"<{p.name}>")
                else:
                    params.append(f"[{p.name}={p.default}]")
            params_str = " " + " ".join(params) if params else ""
            help_lines.append(f"  /{name}{params_str:<30} - {desc}")
        return "\n".join(help_lines)


# Initialize our router
router = SlashCommandRouter()

# Register help command
@router.register("help", "Show all available slash commands and descriptions")
def cmd_help() -> str:
    return router.get_help_text()

# Register sample commands
@router.register("goal", "Define a project goal with a target name and priority rank")
def cmd_goal(description: str, priority_rank: int = 1) -> str:
    return f"[SUCCESS] Goal registered: '{description}' (Priority Rank: {priority_rank})"

@router.register("browser", "Open the specified web URL")
def cmd_browser(url: str, headless: bool = True) -> str:
    mode = "headless" if headless else "windowed"
    return f"[SUCCESS] Opening browser to {url} in {mode} mode..."

@router.register("summarize", "Summarize document by ID, limiting sentences")
def cmd_summarize(doc_id: int, max_sentences: int = 5) -> str:
    return f"[SUCCESS] Summarizing document #{doc_id} (Limit: {max_sentences} sentences)"


# ==============================================================================
# PART 2: SLASH-DELIMITED CONFIGURATION PATH LOOKUPS
# ==============================================================================

class SlashConfig:
    """
    Wraps dictionary structures and provides slash-delimited path lookup
    and nested modifications.
    """
    def __init__(self, data: Dict[str, Any]):
        self._data = data

    def get(self, path: str, default: Any = None) -> Any:
        """
        Retrieves a nested configuration using a path like: '/database/pool/size'
        """
        # Split path, filter out empty strings (removes leading/trailing/double slashes)
        keys = [key for key in path.split("/") if key]
        if not keys:
            return self._data
        
        try:
            return reduce(lambda d, k: d[k], keys, self._data)
        except (KeyError, TypeError):
            return default

    def set(self, path: str, value: Any) -> None:
        """
        Sets a nested configuration value. Creates nested dictionaries if missing.
        """
        keys = [key for key in path.split("/") if key]
        if not keys:
            raise ValueError("Path cannot be empty")
        
        # Walk up to the parent directory level
        current = self._data
        for key in keys[:-1]:
            if key not in current or not isinstance(current[key], dict):
                current[key] = {}
            current = current[key]
        
        # Set the target property
        current[keys[-1]] = value

    @property
    def raw(self) -> Dict[str, Any]:
        return self._data


# Sample Nested App Configuration
SAMPLE_CONFIG = {
    "project": {
        "name": "Document Analyzer Agent",
        "env": "production"
    },
    "database": {
        "sqlite": {
            "path": "memory.sqlite",
            "journal_mode": "WAL"
        },
        "connection": {
            "pool_size": 25,
            "timeout": 30.0
        }
    }
}


# ==============================================================================
# PART 3: INTERACTIVE TEST ENVIRONMENT
# ==============================================================================

def main():
    print("=" * 70)
    print("      SLASH FUNCTIONALITY INTERACTIVE DEMO (PYTHON)     ")
    print("=" * 70)
    
    # 1. Configuration Path Demo
    print("\n--- [Demo 1: Slash-Delimited Configurations] ---")
    config = SlashConfig(SAMPLE_CONFIG)
    
    print("Original raw config: ", config.raw)
    
    print("\nRetrieving nested paths:")
    print("  'project/name'              ->", config.get("project/name"))
    print("  '/database/sqlite/path'     ->", config.get("/database/sqlite/path"))
    print("  'database/connection/pool_size' ->", config.get("database/connection/pool_size"))
    print("  'database/missing/key' (default=99) ->", config.get("database/missing/key", 99))
    
    print("\nSetting nested paths dynamically:")
    print("  Setting 'database/sqlite/journal_mode' to 'DELETE'")
    config.set("database/sqlite/journal_mode", "DELETE")
    print("  Updated: '/database/sqlite/journal_mode' ->", config.get("database/sqlite/journal_mode"))
    
    print("  Setting 'api/v1/auth_enabled' to True (auto-creates nested dicts)")
    config.set("api/v1/auth_enabled", True)
    print("  Updated Config Structure: ", config.raw)
    
    # 2. Slash Command Parser Demo
    print("\n--- [Demo 2: Slash Commands Console] ---")
    print("Registered slash command handlers are ready.")
    print("Type commands below (e.g., /help, /goal \"Draft Q2 reports\" 3, etc.)")
    print("Press Ctrl+C or type 'exit' / 'quit' to close.")
    print(router.get_help_text())
    print("-" * 70)

    while True:
        try:
            print("\nUser: ", end="")
            sys.stdout.flush()
            user_input = sys.stdin.readline().strip()
            if not user_input:
                continue
            if user_input.lower() in ("exit", "quit"):
                print("Exiting. Have a great day!")
                break
                
            response = router.execute(user_input)
            print(f"Bot: {response}")
        except KeyboardInterrupt:
            print("\nExiting. Have a great day!")
            break

if __name__ == "__main__":
    main()

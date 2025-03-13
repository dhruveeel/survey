from flask import Flask, render_template, request, jsonify
import json
import uuid
import networkx as nx
import matplotlib
matplotlib.use('Agg')  # Set non-interactive backend first
import matplotlib.pyplot as plt
import os
import io
import base64
from datetime import datetime
import requests

app = Flask(__name__, static_folder='static')

# Store user sessions
sessions = {}

# JSONBin.io configuration
JSONBIN_API_URL = "https://api.jsonbin.io/v3/b/"
# You'll need to replace these with your actual credentials
JSONBIN_BIN_ID = "67d0ce128561e97a50ea3883"  # Replace with your bin ID
JSONBIN_API_KEY = "$2a$10$0w8uk//5hlkgzaZ8zsWxPORuyBe3SlpcsuxtwglCZ9kyUEyZMbTuS"  # Replace with your API key
JSONBIN_HEADERS = {
    "Content-Type": "application/json",
    "X-Master-Key": JSONBIN_API_KEY
}

@app.route('/')
def index():
    """Render the main page."""
    return render_template('index.html')

@app.route('/submit_user_info', methods=['POST'])
def submit_user_info():
    """Process user information and create a session."""
    data = request.get_json()
    name = data.get('name')
    position = data.get('position')
    email = data.get('email')
    
    # Create a new session ID
    session_id = str(uuid.uuid4())
    
    # Store session data
    sessions[session_id] = {
        'name': name,
        'position': position,
        'email': email,
        'variables': [],
        'dependencies': [],
        'variable_values': {},
        'graph': nx.DiGraph(),
        'cycles': []
    }
    
    return jsonify({'success': True, 'session_id': session_id})

@app.route('/submit_variables', methods=['POST'])
def submit_variables():
    """Process selected variables."""
    data = request.get_json()
    session_id = data.get('session_id')
    variables = data.get('variables')
    
    if session_id not in sessions:
        return jsonify({'success': False, 'error': 'Invalid session'})
    
    # Update session with variables
    sessions[session_id]['variables'] = variables
    
    # Initialize graph with nodes
    G = nx.DiGraph()
    for var in variables:
        G.add_node(var)
    
    sessions[session_id]['graph'] = G
    
    # Initialize variable_values dictionary with empty values
    sessions[session_id]['variable_values'] = {var: "" for var in variables}
    
    return jsonify({'success': True})

@app.route('/get_dependency_options', methods=['GET'])
def get_dependency_options():
    """Get possible dependency pairs to evaluate."""
    session_id = request.args.get('session_id')
    
    if session_id not in sessions:
        return jsonify({'success': False, 'error': 'Invalid session'})
    
    variables = sessions[session_id]['variables']
    dependencies = sessions[session_id]['dependencies']
    
    # Generate all possible pairs that have not been evaluated yet
    all_pairs = []
    for i, var1 in enumerate(variables):
        for j, var2 in enumerate(variables):
            if i != j:  # Exclude self-loops
                pair = {'source': var1, 'target': var2}
                # Check if this pair hasn't been evaluated yet
                if not any(d['source'] == pair['source'] and d['target'] == pair['target'] for d in dependencies):
                    all_pairs.append(pair)
    
    return jsonify({'success': True, 'pairs': all_pairs})

@app.route('/add_dependency', methods=['POST'])
def add_dependency():
    """Add a dependency between variables."""
    data = request.get_json()
    session_id = data.get('session_id')
    source = data.get('source')
    target = data.get('target')
    
    if session_id not in sessions:
        return jsonify({'success': False, 'error': 'Invalid session'})
    
    G = sessions[session_id]['graph']
    
    # Add the edge unconditionally
    G.add_edge(source, target)
    
    # Check for cycles
    cycles = list(nx.simple_cycles(G))
    sessions[session_id]['cycles'] = cycles
    
    # Add the dependency to the list
    dependency = {'source': source, 'target': target}
    sessions[session_id]['dependencies'].append(dependency)
    
    # Create graph image with cycles highlighted
    image = create_graph_image(G, cycles)
    
    return jsonify({
        'success': True,
        'cycles_detected': len(cycles) > 0,
        'cycle_count': len(cycles),
        'cycles': cycles,
        'image': image,
        'dependencies': sessions[session_id]['dependencies']
    })

@app.route('/get_current_dependencies', methods=['GET'])
def get_current_dependencies():
    """Get the current dependencies list."""
    session_id = request.args.get('session_id')
    
    if session_id not in sessions:
        return jsonify({'success': False, 'error': 'Invalid session'})
    
    dependencies = sessions[session_id]['dependencies']
    cycles = sessions[session_id]['cycles']
    
    return jsonify({
        'success': True,
        'dependencies': dependencies,
        'cycles': cycles
    })

@app.route('/remove_dependency', methods=['POST'])
def remove_dependency():
    """Remove a dependency between variables."""
    data = request.get_json()
    session_id = data.get('session_id')
    source = data.get('source')
    target = data.get('target')
    
    if session_id not in sessions:
        return jsonify({'success': False, 'error': 'Invalid session'})
    
    G = sessions[session_id]['graph']
    
    if G.has_edge(source, target):
        G.remove_edge(source, target)
        
        # Update dependencies list
        sessions[session_id]['dependencies'] = [
            d for d in sessions[session_id]['dependencies'] 
            if not (d['source'] == source and d['target'] == target)
        ]
        
        # Recalculate cycles
        cycles = list(nx.simple_cycles(G))
        sessions[session_id]['cycles'] = cycles
        
        # Create graph image with cycles highlighted
        image = create_graph_image(G, cycles)
        
        return jsonify({
            'success': True,
            'cycles_detected': len(cycles) > 0,
            'cycle_count': len(cycles),
            'cycles': cycles,
            'image': image,
            'dependencies': sessions[session_id]['dependencies']
        })
    else:
        return jsonify({'success': False, 'error': 'Dependency does not exist'})

@app.route('/get_current_graph', methods=['GET'])
def get_current_graph():
    """Get the current graph visualization."""
    session_id = request.args.get('session_id')
    
    if session_id not in sessions:
        return jsonify({'success': False, 'error': 'Invalid session'})
    
    G = sessions[session_id]['graph']
    cycles = sessions[session_id]['cycles']
    
    return jsonify({
        'success': True,
        'image': create_graph_image(G, cycles),
        'cycles': cycles,
        'dependencies': sessions[session_id]['dependencies']
    })

@app.route('/get_variables_for_values', methods=['GET'])
def get_variables_for_values():
    """Get variables for value input."""
    session_id = request.args.get('session_id')
    
    if session_id not in sessions:
        return jsonify({'success': False, 'error': 'Invalid session'})
    
    variables = sessions[session_id]['variables']
    
    return jsonify({
        'success': True,
        'variables': variables
    })

@app.route('/submit_variable_values', methods=['POST'])
def submit_variable_values():
    """Submit values for variables."""
    data = request.get_json()
    session_id = data.get('session_id')
    variable_values = data.get('variable_values')
    
    if session_id not in sessions:
        return jsonify({'success': False, 'error': 'Invalid session'})
    
    # Update session with variable values
    sessions[session_id]['variable_values'] = variable_values
    
    return jsonify({'success': True})

@app.route('/save_results', methods=['POST'])
def save_results():
    """Save the final results to JSONBin."""
    session_id = request.args.get('session_id')
    
    if session_id not in sessions:
        return jsonify({'success': False, 'error': 'Invalid session'})
    
    user_data = sessions[session_id]
    
    # Create a timestamp for identification
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Prepare data to save
    save_data = {
        'timestamp': timestamp,
        'name': user_data['name'],
        'position': user_data['position'],
        'email': user_data['email'],
        'variables': user_data['variables'],
        'dependencies': user_data['dependencies'],
        'variable_values': user_data['variable_values'],
        'cycles': user_data['cycles']
    }
    
    try:
        # First, get the current data from JSONBin
        response = requests.get(
            f"{JSONBIN_API_URL}{JSONBIN_BIN_ID}/latest",
            headers=JSONBIN_HEADERS
        )
        
        if response.status_code == 200:
            # Extract the current data
            current_data = response.json().get('record', [])
            
            # If the current data is not a list, initialize it as one
            if not isinstance(current_data, list):
                current_data = []
            
            # Append the new data
            current_data.append(save_data)
            
            # Update the JSONBin with the new data
            update_response = requests.put(
                f"{JSONBIN_API_URL}{JSONBIN_BIN_ID}",
                json=current_data,
                headers=JSONBIN_HEADERS
            )
            
            if update_response.status_code == 200:
                return jsonify({'success': True})
            else:
                return jsonify({
                    'success': False, 
                    'error': f"Error updating JSONBin: {update_response.text}"
                })
        else:
            return jsonify({
                'success': False, 
                'error': f"Error accessing JSONBin: {response.text}"
            })
    
    except Exception as e:
        return jsonify({
            'success': False, 
            'error': f"Error: {str(e)}"
        })

def create_graph_image(G, cycles=None):
    """Create a base64 encoded image of the graph with cycles highlighted."""
    plt.figure(figsize=(10, 10))
    pos = nx.spring_layout(G)
    
    # Draw all nodes
    nx.draw(G, pos, with_labels=True, node_color='lightblue', 
            node_size=2000, arrows=True, arrowsize=15, 
            font_size=10, font_weight='bold')
    
    # Draw all edges in gray
    #nx.draw_networkx_edges(G, pos, edge_color='gray', arrows=True, arrowsize=15)
    
    # Highlight cycle edges in red
    if cycles and len(cycles) > 0:
        cycle_edges = []
        for cycle in cycles:
            for i in range(len(cycle)):
                cycle_edges.append((cycle[i], cycle[(i+1) % len(cycle)]))
        
        nx.draw_networkx_edges(G, pos, edgelist=cycle_edges, edge_color='red', 
                               arrows=True, arrowsize=15, width=2.0)
    
    # Draw labels
    nx.draw_networkx_labels(G, pos, font_size=10, font_weight='bold')
    
    # Save to a base64 string
    img_data = io.BytesIO()
    plt.savefig(img_data, format='png')
    img_data.seek(0)
    plt.close()
    
    encoded = base64.b64encode(img_data.read()).decode('utf-8')
    return f"data:image/png;base64,{encoded}"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)

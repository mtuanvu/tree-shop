import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CiEdit } from "react-icons/ci";
import { MdDeleteOutline } from "react-icons/md";
import './TreeApp.scss';

const TreeApp = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(null);
  const [trees, setTrees] = useState([]);
  const [editId, setEditId] = useState(null); 

  // Hàm để thêm cây mới hoặc chỉnh sửa cây
  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);

    // Chỉ thêm ảnh vào formData nếu người dùng chọn ảnh mới
    if (image) {
      formData.append('image', image);
    }

    try {
      if (editId) {
        await axios.put(`http://localhost:3000/trees/${editId}`, formData);
        setTrees(trees.map(tree => (tree.id === editId ? { ...tree, name, description, imageUrl: tree.imageUrl } : tree)));
        setEditId(null);
      } else {
        const response = await axios.post('http://localhost:3000/trees', formData);
        setTrees([response.data, ...trees]);
      }
      setName('');
      setDescription('');
      setImage(null);
    } catch (error) {
      console.error('Error adding/editing tree:', error);
    }
  };

  // Hàm để lấy danh sách cây
  const fetchTrees = async () => {
    try {
      const response = await axios.get('http://localhost:3000/trees');
      setTrees(response.data);
    } catch (error) {
      console.error('Error fetching trees:', error);
    }
  };

  useEffect(() => {
    fetchTrees();
  }, []);

  // Hàm để xóa cây
  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://localhost:3000/trees/${id}`);
      setTrees(trees.filter(tree => tree.id !== id));
    } catch (error) {
      console.error('Error deleting tree:', error);
    }
  };

  // Hàm để bắt đầu chỉnh sửa cây
  const handleEdit = (tree) => {
    setName(tree.name);
    setDescription(tree.description);
    setEditId(tree.id);
  };

  return (
    <div className="tree-app">
      <h1>Tree Shop</h1>

      <form onSubmit={handleSubmit} className="tree-form">
        <input
          type="text"
          placeholder="Tree Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        <input
          type="file"
          onChange={(e) => setImage(e.target.files[0])}
          required={!editId} 
        />
        <button type="submit">{editId ? 'Save Changes' : 'Add Tree'}</button>
      </form>

      <h2>Tree List</h2>
      <div className="tree-list">
        {trees.map((tree) => (
          <div key={tree.id} className="tree-item">
            <img src={tree.imageUrl} alt={tree.name} width="100" />
            <div>
              <h3>{tree.name}</h3>
              <p>{tree.description}</p>
            </div>
            <button onClick={() => handleEdit(tree)}>
              <CiEdit size={20} />
            </button>
            <button onClick={() => handleDelete(tree.id)}>
              <MdDeleteOutline size={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TreeApp;
